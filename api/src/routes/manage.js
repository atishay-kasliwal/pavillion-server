import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import {
  deleteImmichAsset,
  createImmichAlbum,
  addImmichAlbumAssets,
  removeImmichAlbumAssets,
} from '../clients/immich.js';
import { getNavidromeSongPath, triggerNavidromeScan } from '../clients/navidrome.js';
import { deleteFilebrowserPath, renameFilebrowserPath } from '../clients/filebrowser.js';

export const manageRouter = Router();

// --- Immich: delete + album organization (its actual primitive — assets
// don't have a renameable filename the way Filebrowser/Navidrome do) ---

manageRouter.delete('/immich/:id', async (req, res, next) => {
  try {
    const permanent = req.query.permanent === 'true';
    await deleteImmichAsset(req.params.id, permanent);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

manageRouter.post('/immich/albums', async (req, res, next) => {
  try {
    const { name, assetIds } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'missing required field: name' });
    res.status(201).json(await createImmichAlbum(name, assetIds ?? []));
  } catch (err) {
    next(err);
  }
});

manageRouter.put('/immich/albums/:id/assets', async (req, res, next) => {
  try {
    const { assetIds } = req.body ?? {};
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'missing required field: assetIds (non-empty array)' });
    }
    await addImmichAlbumAssets(req.params.id, assetIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

manageRouter.delete('/immich/albums/:id/assets', async (req, res, next) => {
  try {
    const { assetIds } = req.body ?? {};
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'missing required field: assetIds (non-empty array)' });
    }
    await removeImmichAlbumAssets(req.params.id, assetIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Navidrome: no write API exists (Subsonic is read-only for library
// content) — delete/rename are direct filesystem ops on the shared music
// folder, same trick routes/upload.js uses, followed by a rescan so
// Navidrome's index catches up with what's actually on disk. ---

function resolveMusicPath(relPath) {
  const resolved = path.resolve(config.musicDir, relPath);
  // Guard against a path that escapes the music root (e.g. `../../etc/passwd`
  // arriving via a Subsonic path we didn't expect, or a crafted destination).
  if (!resolved.startsWith(path.resolve(config.musicDir) + path.sep)) {
    throw new Error('resolved path escapes the music directory');
  }
  return resolved;
}

manageRouter.delete('/navidrome/:id', async (req, res, next) => {
  try {
    const relPath = await getNavidromeSongPath(req.params.id);
    await fs.unlink(resolveMusicPath(relPath));
    await triggerNavidromeScan();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

manageRouter.patch('/navidrome/:id', async (req, res, next) => {
  try {
    const destination = req.body?.path;
    if (!destination) return res.status(400).json({ error: 'missing required field: path' });

    const currentRelPath = await getNavidromeSongPath(req.params.id);
    const from = resolveMusicPath(currentRelPath);
    const to = resolveMusicPath(destination);

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    await triggerNavidromeScan();
    res.status(200).json({ path: destination });
  } catch (err) {
    next(err);
  }
});

// --- Filebrowser: native delete/rename/move API ---

manageRouter.delete('/filebrowser/*', async (req, res, next) => {
  try {
    await deleteFilebrowserPath(`/${req.params[0]}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

manageRouter.patch('/filebrowser/*', async (req, res, next) => {
  try {
    const destination = req.body?.destination;
    if (!destination) return res.status(400).json({ error: 'missing required field: destination' });
    await renameFilebrowserPath(`/${req.params[0]}`, destination);
    res.status(200).json({ path: destination });
  } catch (err) {
    next(err);
  }
});
