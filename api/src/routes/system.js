import fs from 'node:fs';
import { Router } from 'express';

export const systemRouter = Router();

// Reads free/total space for the filesystem archive-api's own volumes live
// on (checked via /music, the one guaranteed to be mounted — see
// docker-compose.yml). MUSIC_LOCATION/TAKEOUT_LOCATION/PHOTOS_LOCATION are
// all subpaths of the same host data disk in the reference .env, so this
// reflects the real disk the whole archive shares, not just the music
// folder's own usage.
systemRouter.get('/system/storage', (_req, res, next) => {
  try {
    const stats = fs.statfsSync('/music');
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    res.json({ totalBytes, freeBytes, usedBytes: totalBytes - stats.bfree * stats.bsize });
  } catch (err) {
    next(err);
  }
});
