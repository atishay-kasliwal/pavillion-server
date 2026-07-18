import crypto from 'node:crypto';
import { config } from '../config.js';

const { baseUrl, username, password } = config.navidrome;

// Navidrome speaks the Subsonic API, which authenticates with a salted
// token per request rather than a bearer header.
function authParams() {
  const salt = crypto.randomBytes(6).toString('hex');
  const token = crypto.createHash('md5').update(password + salt).digest('hex');
  return new URLSearchParams({
    u: username,
    t: token,
    s: salt,
    v: '1.16.1',
    c: 'pavillion-archive-api',
    f: 'json',
  });
}

async function subsonicGet(endpoint, extraParams = {}) {
  const params = authParams();
  for (const [key, value] of Object.entries(extraParams)) params.set(key, value);

  const res = await fetch(`${baseUrl}/rest/${endpoint}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Navidrome ${endpoint} -> ${res.status}`);
  }
  const body = await res.json();
  const inner = body['subsonic-response'];
  if (inner?.status !== 'ok') {
    throw new Error(`Navidrome ${endpoint} error: ${inner?.error?.message ?? 'unknown'}`);
  }
  return inner;
}

export async function searchNavidrome(query) {
  const result = await subsonicGet('search3', { query, songCount: 25, albumCount: 0, artistCount: 0 });
  const songs = result.searchResult3?.song ?? [];

  return songs.map((song) => ({
    source: 'navidrome',
    type: 'audio',
    id: song.id,
    name: `${song.artist ?? 'Unknown artist'} — ${song.title}`,
    createdAt: song.created,
    size: song.size ?? null,
    thumbnailUrl: `/api/media/navidrome/${song.id}/cover`,
    url: `/api/media/navidrome/${song.id}/stream`,
  }));
}

export async function navidromeCoverArt(id) {
  const params = authParams();
  params.set('id', id);
  return fetch(`${baseUrl}/rest/getCoverArt?${params.toString()}`);
}

export async function navidromeStream(id) {
  const params = authParams();
  params.set('id', id);
  return fetch(`${baseUrl}/rest/stream?${params.toString()}`);
}

// Called after an audio file is written into the shared music directory
// (see routes/upload.js) so Navidrome picks it up without waiting for its
// hourly ND_SCANSCHEDULE.
export async function triggerNavidromeScan() {
  await subsonicGet('startScan');
}
