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
  const results = await res.json();

  return (results ?? []).map((entry) => ({
    source: 'filebrowser',
    type: 'file',
    id: entry.path,
    name: entry.name ?? entry.path.split('/').pop(),
    createdAt: entry.modified ?? null,
    size: entry.size ?? null,
    thumbnailUrl: null,
    url: `/api/media/filebrowser${entry.path}`,
  }));
}

export async function uploadToFilebrowser(file, destPath) {
  await fbFetch(`/api/resources${destPath}?override=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file.buffer,
  });
}

export async function fetchFilebrowserFile(path) {
  return fbFetch(`/api/raw${path}`);
}
