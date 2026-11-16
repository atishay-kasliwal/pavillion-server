import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
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

const AUDIO_EXTENSIONS = new Set([
  'aac',
  'aiff',
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'wav',
]);

function toFilebrowserMediaPath(filePath) {
  const relative = path.relative(config.musicDir, filePath).split(path.sep).join('/');
  return path.posix.join('/music', relative);
}

function toMusicMediaPath(filePath) {
  return path
    .relative(config.musicDir, filePath)
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');
}

function mapFilesystemSong(filePath, stat) {
  const parsed = parseFilesystemTrack(filePath);
  const title = parsed.title || path.basename(filePath);
  const name =
    parsed.artist && parsed.artist !== 'Unknown artist' && title
      ? `${parsed.artist} — ${title}`
      : title;
  const createdAt = stat?.birthtime ?? stat?.mtime ?? null;

  return {
    source: 'filebrowser',
    type: 'audio',
    id: filePath,
    name,
    createdAt: createdAt?.toISOString?.() ?? null,
    size: stat?.size ?? null,
    thumbnailUrl: null,
    url: `/api/media/music/${toMusicMediaPath(filePath)}`,
  };
}

function parseFilesystemTrack(filePath) {
  const relativePath = path.relative(config.musicDir, filePath);
  const parts = relativePath.split(path.sep).filter(Boolean);
  const basename = path.basename(filePath, path.extname(filePath)).trim();

  const parsed = {
    artist: 'Unknown artist',
    album: 'Unknown album',
    title: basename || path.basename(filePath),
  };

  if (parts.length >= 3) {
    parsed.artist = parts[0] || parsed.artist;
    parsed.album = parts[parts.length - 2] || parsed.album;
    return parsed;
  }

  if (parts.length === 2) {
    parsed.album = parts[0] || parsed.album;
    return parsed;
  }

  if (parts.length === 1 && basename.includes(' - ')) {
    const [artist, title] = basename.split(' - ', 2);
    parsed.artist = artist.trim() || parsed.artist;
    parsed.title = title.trim() || parsed.title;
  }

  return parsed;
}

function filesystemArtistId(artist) {
  return `fs-${encodeURIComponent(artist)}`
}

function filesystemAlbumId(artist, album) {
  return `fs-${encodeURIComponent(`${artist}::${album}`)}`
}

function decodeFilesystemArtistId(artistId) {
  return decodeURIComponent(artistId.replace(/^fs-/, ''))
}

async function listFilesystemAudioFiles(currentDir = config.musicDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesystemAudioFiles(fullPath)));
      continue;
    }
    if (AUDIO_EXTENSIONS.has(path.extname(entry.name).slice(1).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function listFilesystemSongs() {
  const files = await listFilesystemAudioFiles();
  const stats = await Promise.all(
    files.map(async (file) => ({
      file,
      stat: await fs.stat(file).catch(() => null),
    })),
  );
  return stats
    .map(({ file, stat }) => mapFilesystemSong(file, stat ?? undefined))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.NEGATIVE_INFINITY;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.NEGATIVE_INFINITY;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });
}

export async function searchNavidrome(query) {
  const result = await subsonicGet('search3', { query, songCount: 25, albumCount: 0, artistCount: 0 });
  const songs = result.searchResult3?.song ?? [];
  return songs.map(mapNavidromeSong);
}

// A random cross-library set for the Music tab's "Shuffle all".
// We sweep the full music directory directly so the queue reflects the whole
// library, not just whatever slice Navidrome's metadata API decides to return.
export async function getNavidromeRandomSongs(size = Number.POSITIVE_INFINITY) {
  const songs = await listFilesystemSongs();
  if (songs.length === 0) return [];

  for (let i = songs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }

  const limit = Number.isFinite(size) && size > 0 ? size : songs.length;
  return songs.slice(0, Math.min(limit, songs.length));
}

export async function listNavidromeSongs() {
  return listFilesystemSongs();
}

// Browse (not search) — the library, top-down: artists -> albums -> songs.
export async function listNavidromeArtists() {
  let result;
  try {
    result = await subsonicGet('getIndexes');
  } catch (err) {
    // Navidrome errors instead of returning an empty index when nothing's
    // been scanned into the library yet — that's a legitimate empty state,
    // not a failure, so it shouldn't surface as a 500.
    if (/library not found or empty/i.test(err.message)) return [];
    throw err;
  }

  const indexes = result.indexes?.index ?? [];
  const artists = indexes.flatMap((idx) => idx.artist ?? []).map((artist) => ({
    id: artist.id,
    name: artist.name,
    albumCount: artist.albumCount ?? 0,
  }));
  if (artists.length > 0) return artists;

  // Some older/quirkier Navidrome setups may return an empty index structure
  // even though the library is healthy. Fall back to the tagged artist view.
  const fallback = await subsonicGet('getArtists');
  const fallbackIndexes = fallback.artists?.index ?? [];
  return fallbackIndexes.flatMap((idx) => idx.artist ?? []).map((artist) => ({
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

export async function navidromeStream(id, headers = {}) {
  const params = authParams();
  params.set('id', id);
  // Forward the client's Range header so seeking works (see routes/media.js).
  return fetch(`${baseUrl}/rest/stream?${params.toString()}`, { headers });
}

// Called after an audio file is written into the shared music directory
// (see routes/upload.js) so Navidrome picks it up without waiting for its
// hourly ND_SCANSCHEDULE.
export async function triggerNavidromeScan() {
  await subsonicGet('startScan');
}
