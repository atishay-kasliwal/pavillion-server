import { openAsBlob } from 'node:fs';
import { config } from '../config.js';

const { baseUrl, username, password } = config.filebrowser;

// Filebrowser issues a short-lived JWT from /api/login. Cached in memory
// and refreshed on 401 — fine for a single-process, single-replica API.
let tokenCache = null;

async function login() {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Filebrowser login -> ${res.status}`);
  }
  tokenCache = (await res.text()).trim();
  return tokenCache;
}

async function fbFetch(path, options = {}, retried = false) {
  const token = tokenCache ?? (await login());
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'X-Auth': token,
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried) {
    tokenCache = null;
    return fbFetch(path, options, true);
  }
  if (!res.ok) {
    throw new Error(`Filebrowser ${options.method ?? 'GET'} ${path} -> ${res.status}`);
  }
  return res;
}

export async function searchFilebrowser(query) {
  const res = await fbFetch(`/api/search/?query=${encodeURIComponent(query)}`);
  // Filebrowser streams one JSON object per line (NDJSON, not a JSON array)
  // with only {dir, path} — no name/size/modified — and an empty body
  // (not `[]`) when nothing matches.
  const body = await res.text();
  const entries = body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => !entry.dir);

  return entries.map((entry) => {
    // Filebrowser's search results omit the leading slash that /api/raw
    // and /api/resources both require.
    const path = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
    return {
      source: 'filebrowser',
      type: 'file',
      id: path,
      name: path.split('/').pop(),
      createdAt: null,
      size: null,
      thumbnailUrl: null,
      url: `/api/media/filebrowser${path}`,
    };
  });
}

export async function uploadToFilebrowser(file, destPath) {
  // Stream the spooled temp file straight through rather than reading it into
  // a buffer first — same memory-safety reasoning as the Immich upload path.
  const blob = await openAsBlob(file.path, { type: 'application/octet-stream' });
  await fbFetch(`/api/resources${destPath}?override=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
    duplex: 'half',
  });
}

export async function fetchFilebrowserFile(path, headers = {}) {
  // Forward the client's Range header so media scrubbing works (see media.js).
  return fbFetch(`/api/raw${path}`, { headers });
}

// Browse (not search) — list one directory's immediate contents.
export async function listFilebrowserFolder(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await fbFetch(`/api/resources${normalized}`);
  const body = await res.json();
  const items = body.items ?? [];

  return items.map((item) => {
    const itemPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
    return {
      name: item.name,
      isDir: item.isDir,
      size: item.isDir ? null : item.size ?? null,
      modified: item.modified ?? null,
      path: itemPath,
      url: item.isDir ? null : `/api/media/filebrowser${itemPath}`,
    };
  });
}

// Filebrowser creates a directory (rather than a file) when the resource
// path ends in a trailing slash.
export async function createFilebrowserFolder(path) {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const withTrailingSlash = withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
  await fbFetch(`/api/resources${withTrailingSlash}?override=false`, { method: 'POST' });
}

export async function deleteFilebrowserPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  await fbFetch(`/api/resources${normalized}`, { method: 'DELETE' });
}

// Filebrowser's rename/move is the same operation (its own UI doesn't
// distinguish them) — `destination` is the full new path, not just a name.
export async function renameFilebrowserPath(fromPath, toPath) {
  const from = fromPath.startsWith('/') ? fromPath : `/${fromPath}`;
  const to = toPath.startsWith('/') ? toPath : `/${toPath}`;
  await fbFetch(`/api/resources${from}?action=rename&destination=${encodeURIComponent(to)}&override=false`, {
    method: 'PATCH',
  });
}
