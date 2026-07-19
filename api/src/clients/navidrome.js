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

// Navidrome's own native API (separate from the Subsonic compatibility
// layer above) uses JWT auth via /auth/login. Needed for getNavidromeSongPath
// below — the Subsonic API's `path` field is a virtualized Artist/Album/Title
// display path, not the real file location; the native API's is the real one.
let nativeTokenCache = null;

async function nativeLogin() {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Navidrome native login -> ${res.status}`);
  }
  const body = await res.json();
  nativeTokenCache = body.token;
  return nativeTokenCache;
}

async function nativeFetch(path, retried = false) {
  const token = nativeTokenCache ?? (await nativeLogin());
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-nd-authorization': `Bearer ${token}` },
  });
  if (res.status === 401 && !retried) {
    nativeTokenCache = null;
    return nativeFetch(path, true);
  }
  if (!res.ok) {
    throw new Error(`Navidrome native GET ${path} -> ${res.status}`);
  }
  return res.json();
}

function mapNavidromeSong(song) {
  return {
    source: 'navidrome',
    type: 'audio',
    id: song.id,
    name: `${song.artist ?? 'Unknown artist'} — ${song.title}`,
    createdAt: song.created,
    size: song.size ?? null,
    thumbnailUrl: `/api/media/navidrome/${song.id}/cover`,
    url: `/api/media/navidrome/${song.id}/stream`,
  };
}

export async function searchNavidrome(query) {
  const result = await subsonicGet('search3', { query, songCount: 25, albumCount: 0, artistCount: 0 });
  const songs = result.searchResult3?.song ?? [];
  return songs.map(mapNavidromeSong);
}

// A random cross-library set for the Music tab's "Shuffle all" — Subsonic's
// getRandomSongs picks from the whole library server-side, so there's no need
// to walk every artist/album on the client. `size` is Subsonic's own cap
// (default 10); 200 gives a long shuffle queue without an unbounded response.
export async function getNavidromeRandomSongs(size = 200) {
  let result;
  try {
    result = await subsonicGet('getRandomSongs', { size: String(size) });
  } catch (err) {
    // Same empty-library case as listNavidromeArtists — nothing scanned yet
    // is a legitimate empty state, not a 500.
    if (/library not found or empty/i.test(err.message)) return [];
    throw err;
  }
  const songs = result.randomSongs?.song ?? [];
  return songs.map(mapNavidromeSong);
}

// Browse (not search) — the library, top-down: artists -> albums -> songs.
export async function listNavidromeArtists() {
  let result;
  try {
    result = await subsonicGet('getArtists');
  } catch (err) {
    // Navidrome errors instead of returning an empty index when nothing's
    // been scanned into the library yet — that's a legitimate empty state,
    // not a failure, so it shouldn't surface as a 500.
    if (/library not found or empty/i.test(err.message)) return [];
    throw err;
  }
  const indexes = result.artists?.index ?? [];
  return indexes.flatMap((idx) => idx.artist ?? []).map((artist) => ({
    id: artist.id,
    name: artist.name,
    albumCount: artist.albumCount ?? 0,
  }));
}

export async function listNavidromeArtistAlbums(artistId) {
  const result = await subsonicGet('getArtist', { id: artistId });
  const albums = result.artist?.album ?? [];
  return albums.map((album) => ({
    id: album.id,
    name: album.name,
    year: album.year ?? null,
    songCount: album.songCount ?? 0,
    thumbnailUrl: `/api/media/navidrome/${album.id}/cover`,
  }));
}

export async function listNavidromeAlbumSongs(albumId) {
  const result = await subsonicGet('getAlbum', { id: albumId });
  const songs = result.album?.song ?? [];
  return songs.map(mapNavidromeSong);
}

// Returns the file's real path relative to the music root — needed
// because delete/rename have no Subsonic write API and have to happen as
// direct filesystem operations (see routes/manage.js). Deliberately uses
// the native API, not Subsonic's getSong: Subsonic's `path` is a
// virtualized "Artist/Album/Title" display path that does NOT match the
// real file location for untagged/mistagged files (confirmed live —
// Subsonic reported "[Unknown Artist]/[Unknown Album]/x.wav" for a file
// that actually sits flat at the music root).
export async function getNavidromeSongPath(id) {
  const song = await nativeFetch(`/api/song/${id}`);
  if (!song?.path) throw new Error(`Navidrome song ${id} not found`);
  return song.path;
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
