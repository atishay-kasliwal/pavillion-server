import { openAsBlob } from 'node:fs';
import { config } from '../config.js';

const { baseUrl, apiKey } = config.immich;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function immichFetch(path, options = {}, attempt = 1) {
  // Callers whose body can't be replayed (uploadToImmich streams a one-shot
  // disk-backed Blob) pass noRetry and own their retry loop instead — a retry
  // here would re-send an already-consumed body.
  const { noRetry, ...fetchOptions } = options;
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers: {
        'x-api-key': apiKey,
        ...fetchOptions.headers,
      },
    });
  } catch (err) {
    // Immich's HTTP server occasionally resets a connection under a burst
    // of near-simultaneous requests (seen live: ECONNRESET, low frequency,
    // not a crash) — retry once after a brief pause instead of surfacing a
    // transient network blip as a 500.
    if (attempt < 2 && !noRetry) {
      await sleep(200);
      return immichFetch(path, options, attempt + 1);
    }
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Immich ${options.method ?? 'GET'} ${path} -> ${res.status}`);
  }
  return res;
}

function mapImmichAsset(asset) {
  return {
    source: 'immich',
    type: asset.type === 'VIDEO' ? 'video' : 'photo',
    id: asset.id,
    name: asset.originalFileName,
    createdAt: asset.fileCreatedAt,
    size: asset.exifInfo?.fileSizeInByte ?? null,
    thumbnailUrl: `/api/media/immich/${asset.id}/thumbnail`,
    url: `/api/media/immich/${asset.id}/original`,
    latitude: asset.exifInfo?.latitude ?? null,
    longitude: asset.exifInfo?.longitude ?? null,
  };
}

// Uses Immich's smart (CLIP) search when available, which is the whole
// reason we're not building a separate vector search pipeline — see
// PLAN.md "Application stack". Falls back to metadata/filename search on
// older Immich versions that don't have /search/smart.
export async function searchImmich(query) {
  let body;
  try {
    const res = await immichFetch('/api/search/smart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page: 1 }),
    });
    body = await res.json();
  } catch {
    const res = await immichFetch('/api/search/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalFileName: query, page: 1 }),
    });
    body = await res.json();
  }

  const items = body?.assets?.items ?? [];
  return items.map(mapImmichAsset);
}

// Browse (not search) — the timeline in upload-recency order, paginated.
// Same /search/metadata endpoint as the fallback above, just with no
// filter, since Immich has no dedicated "list everything" route.
export async function listImmichAssets(page = 1, size = 50) {
  const res = await immichFetch('/api/search/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, size }),
  });
  const body = await res.json();
  return {
    items: (body?.assets?.items ?? []).map(mapImmichAsset),
    nextPage: body?.assets?.nextPage ?? null,
  };
}

export async function listImmichAlbums() {
  const res = await immichFetch('/api/albums');
  const albums = await res.json();
  return albums.map((album) => ({
    id: album.id,
    name: album.albumName,
    assetCount: album.assetCount,
    thumbnailUrl: album.albumThumbnailAssetId
      ? `/api/media/immich/${album.albumThumbnailAssetId}/thumbnail`
      : null,
  }));
}

// GET /api/albums/:id does NOT embed its assets in this Immich version
// (confirmed live — no `assets` field at all in the response, despite
// `assetCount` being accurate) — listing an album's contents means a
// metadata search scoped to it instead.
export async function listImmichAlbumAssets(albumId) {
  const res = await immichFetch('/api/search/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ albumId }),
  });
  const body = await res.json();
  return (body?.assets?.items ?? []).map(mapImmichAsset);
}

// `permanent: false` (default) moves to trash, matching Immich's own UI
// behavior — recoverable for 30 days rather than gone immediately.
export async function deleteImmichAsset(assetId, permanent = false) {
  await immichFetch('/api/assets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [assetId], force: permanent }),
  });
}

// Albums are Immich's actual organizational primitive — there's no
// filename/rename concept for assets, so "organize" means album membership.
export async function createImmichAlbum(name, assetIds = []) {
  const res = await immichFetch('/api/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ albumName: name, assetIds }),
  });
  return res.json();
}

export async function addImmichAlbumAssets(albumId, assetIds) {
  await immichFetch(`/api/albums/${albumId}/assets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: assetIds }),
  });
}

export async function removeImmichAlbumAssets(albumId, assetIds) {
  await immichFetch(`/api/albums/${albumId}/assets`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: assetIds }),
  });
}

// A large upload batch can briefly knock Immich over — its ffmpeg thumbnail
// jobs get OOM-killed, it thrashes and restarts, and for a few seconds the
// API sees ECONNREFUSED (port not listening) or a headers timeout (alive but
// too slow). Seen live: a 1000+ file batch where every queued upload came
// back 500 during those windows. Retry with backoff long enough to ride out
// a restart instead of failing the file permanently. Safe to replay: Immich
// dedupes by checksum, so a redundant attempt returns status 'duplicate'
// rather than storing the bytes twice. The body (a disk-backed Blob) can't be
// reused once undici has consumed it, so each attempt rebuilds the FormData
// from the still-present temp file.
const UPLOAD_RETRY_DELAYS_MS = [1000, 3000, 8000];

function isTransientUploadError(err) {
  const cause = err?.cause;
  const code = cause?.code ?? err?.code;
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'UND_ERR_HEADERS_TIMEOUT') {
    return true;
  }
  // A 5xx from Immich itself (overloaded, restarting) is also worth retrying;
  // a 4xx (e.g. a rejected/unsupported file) is not and should surface.
  const status = Number(/-> (\d{3})$/.exec(err?.message ?? '')?.[1]);
  return status >= 500 && status < 600;
}

export async function uploadToImmich(file) {
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    // openAsBlob returns a Blob backed by the spooled temp file on disk, read
    // lazily as undici streams the multipart body — so a large video is never
    // pulled fully into memory (which used to OOM-kill this container on files
    // in the ~100 MB range; see routes/upload.js).
    const blob = await openAsBlob(file.path, { type: file.mimetype });
    form.append('assetData', blob, file.originalname);
    form.append('deviceAssetId', `pavillion-api-${Date.now()}-${file.originalname}`);
    form.append('deviceId', 'pavillion-archive-api');
    form.append('fileCreatedAt', new Date().toISOString());
    form.append('fileModifiedAt', new Date().toISOString());

    try {
      const res = await immichFetch('/api/assets', { method: 'POST', body: form, noRetry: true });
      return res.json();
    } catch (err) {
      if (attempt < UPLOAD_RETRY_DELAYS_MS.length && isTransientUploadError(err)) {
        await sleep(UPLOAD_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

// Diagnostic only (see routes/system.js) — GET /api/assets/:id returns the
// full AssetResponseDto, to check whether exifInfo is actually populated
// server-side vs. just missing from the /search/metadata list shape.
export async function getImmichAssetDetail(assetId) {
  const res = await immichFetch(`/api/assets/${assetId}`);
  return res.json();
}

export function immichThumbnailProxyPath(assetId) {
  return `/api/assets/${assetId}/thumbnail`;
}

export function immichOriginalProxyPath(assetId) {
  return `/api/assets/${assetId}/original`;
}

export async function fetchImmichMedia(assetId, variant) {
  const path =
    variant === 'thumbnail'
      ? immichThumbnailProxyPath(assetId)
      : immichOriginalProxyPath(assetId);
  return immichFetch(path);
}
