import { config } from '../config.js';

const { baseUrl, apiKey } = config.immich;

async function immichFetch(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'x-api-key': apiKey,
      ...options.headers,
    },
  });
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

export async function listImmichAlbumAssets(albumId) {
  const res = await immichFetch(`/api/albums/${albumId}`);
  const album = await res.json();
  return (album?.assets ?? []).map(mapImmichAsset);
}

export async function uploadToImmich(file) {
  const form = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  form.append('assetData', blob, file.originalname);
  form.append('deviceAssetId', `pavillion-api-${Date.now()}-${file.originalname}`);
  form.append('deviceId', 'pavillion-archive-api');
  form.append('fileCreatedAt', new Date().toISOString());
  form.append('fileModifiedAt', new Date().toISOString());

  const res = await immichFetch('/api/assets', { method: 'POST', body: form });
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
