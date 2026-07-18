import { Router } from 'express';
import { fetchImmichMedia } from '../clients/immich.js';
import { navidromeCoverArt, navidromeStream } from '../clients/navidrome.js';
import { fetchFilebrowserFile } from '../clients/filebrowser.js';

export const mediaRouter = Router();

// Media never gets fetched client-side directly from the backends — the
// frontend only ever talks to archive-api, so upstream URLs/API keys never
// leak past the tunnel. See PLAN.md "custom API service" section.

async function pipe(upstreamPromise, res) {
  const upstream = await upstreamPromise;
  res.status(upstream.status);
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  const body = Buffer.from(await upstream.arrayBuffer());
  res.send(body);
}

mediaRouter.get('/media/immich/:id/:variant', async (req, res, next) => {
  try {
    await pipe(fetchImmichMedia(req.params.id, req.params.variant), res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/navidrome/:id/cover', async (req, res, next) => {
  try {
    await pipe(navidromeCoverArt(req.params.id), res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/navidrome/:id/stream', async (req, res, next) => {
  try {
    await pipe(navidromeStream(req.params.id), res);
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/filebrowser/*', async (req, res, next) => {
  try {
    const path = req.params[0];
    await pipe(fetchFilebrowserFile(`/${path}`), res);
  } catch (err) {
    next(err);
  }
});
