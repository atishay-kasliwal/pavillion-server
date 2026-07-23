import { Router } from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fetchImmichMedia } from '../clients/immich.js';
import { navidromeCoverArt, navidromeStream } from '../clients/navidrome.js';
import { fetchFilebrowserFile } from '../clients/filebrowser.js';
import { config } from '../config.js';

export const mediaRouter = Router();

// Media never gets fetched client-side directly from the backends — the
// frontend only ever talks to archive-api, so upstream URLs/API keys never
// leak past the tunnel. See PLAN.md "custom API service" section.

// Relay these upstream headers so the browser can seek: without
// Accept-Ranges + a 206/Content-Range on Range requests, an <audio>/<video>
// element can't jump to a position (currentTime changes do nothing) — which
// is exactly why the seek bar appeared dead. Content-Length/Content-Type are
// needed for correct playback and duration.
const RELAY_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'content-range',
  'cache-control',
  'last-modified',
  'etag',
];

// Forwards the client's Range header upstream and streams the response back
// (status included, so a 206 stays a 206). Streaming rather than buffering the
// whole body also keeps a large media file off the heap.
async function pipe(upstreamPromise, req, res) {
  const upstream = await upstreamPromise;
  res.status(upstream.status);
  for (const name of RELAY_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  // Web ReadableStream -> Node stream, piped to the response.
  const { Readable } = await import('node:stream');
  Readable.fromWeb(upstream.body).pipe(res);
}

const AUDIO_MIME_BY_EXT = {
  '.aac': 'audio/aac',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function resolveMusicPath(relPath) {
  const resolved = path.resolve(config.musicDir, relPath);
  if (!resolved.startsWith(path.resolve(config.musicDir) + path.sep)) {
    throw new Error('resolved path escapes the music directory');
  }
  return resolved;
}

async function pipeLocalFile(filePath, req, res) {
  const stat = await fsp.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = AUDIO_MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);

  if (!range) {
    res.status(200);
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end < start) {
    res.status(416).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  res.setHeader('Content-Length', chunkSize);
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

// The one header the media proxy forwards upstream — range requests for
// seeking. (An empty object when absent, so clients can spread it safely.)
function rangeHeaders(req) {
  const range = req.headers.range;
  return range ? { Range: range } : {};
}

mediaRouter.get('/media/immich/:id/:variant', async (req, res, next) => {
  try {
    await pipe(fetchImmichMedia(req.params.id, req.params.variant, rangeHeaders(req)), req, res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/navidrome/:id/cover', async (req, res, next) => {
  try {
    await pipe(navidromeCoverArt(req.params.id), req, res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/navidrome/:id/stream', async (req, res, next) => {
  try {
    await pipe(navidromeStream(req.params.id, rangeHeaders(req)), req, res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/music/*', async (req, res, next) => {
  try {
    await pipeLocalFile(resolveMusicPath(req.params[0]), req, res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/filebrowser/*', async (req, res, next) => {
  try {
    const path = req.params[0];
    await pipe(fetchFilebrowserFile(`/${path}`, rangeHeaders(req)), req, res);
  } catch (err) {
    next(err);
  }
});
