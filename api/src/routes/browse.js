import { Router } from 'express';
import { listImmichAssets, listImmichAlbums, listImmichAlbumAssets } from '../clients/immich.js';
import {
  listNavidromeArtists,
  listNavidromeArtistAlbums,
  listNavidromeAlbumSongs,
  listNavidromeSongs,
  getNavidromeRandomSongs,
} from '../clients/navidrome.js';
import { listFilebrowserFolder, createFilebrowserFolder } from '../clients/filebrowser.js';

export const browseRouter = Router();

browseRouter.get('/browse/immich', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    res.json(await listImmichAssets(page));
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/immich/albums', async (_req, res, next) => {
  try {
    res.json({ albums: await listImmichAlbums() });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/immich/albums/:id', async (req, res, next) => {
  try {
    res.json({ items: await listImmichAlbumAssets(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// A random cross-library song set for the Music tab's "Shuffle all".
browseRouter.get('/browse/navidrome/random', async (_req, res, next) => {
  try {
    res.json({ songs: await getNavidromeRandomSongs() });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/navidrome/songs', async (_req, res, next) => {
  try {
    res.json({ songs: await listNavidromeSongs() });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/navidrome/artists', async (_req, res, next) => {
  try {
    res.json({ artists: await listNavidromeArtists() });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/navidrome/artists/:id', async (req, res, next) => {
  try {
    res.json({ albums: await listNavidromeArtistAlbums(req.params.id) });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/navidrome/albums/:id', async (req, res, next) => {
  try {
    res.json({ songs: await listNavidromeAlbumSongs(req.params.id) });
  } catch (err) {
    next(err);
  }
});

browseRouter.get('/browse/filebrowser', async (req, res, next) => {
  try {
    const path = String(req.query.path ?? '/');
    res.json({ path, items: await listFilebrowserFolder(path) });
  } catch (err) {
    next(err);
  }
});

browseRouter.post('/browse/filebrowser/folder', async (req, res, next) => {
  try {
    const folderPath = req.body?.path;
    if (!folderPath) {
      return res.status(400).json({ error: 'missing required field: path' });
    }
    await createFilebrowserFolder(folderPath);
    res.status(201).json({ path: folderPath });
  } catch (err) {
    next(err);
  }
});
