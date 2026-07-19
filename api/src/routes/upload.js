import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { uploadToImmich } from '../clients/immich.js';
import { triggerNavidromeScan } from '../clients/navidrome.js';
import { uploadToFilebrowser, createFilebrowserFolder } from '../clients/filebrowser.js';

export const uploadRouter = Router();

// Files are spooled to a temp file on disk rather than buffered in memory,
// then streamed on to the backend (Immich/Filebrowser) — a 100+ MB video no
// longer needs to fit, twice over, inside the container's tight memory limit
// (archive-api is capped at ~256 MB; see docker-compose.yml). The 200 MB cap
// still bounds a single upload (see PLAN.md "Known Risks"). The temp file is
// always removed once the request settles (see the finally block below).
const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function classify(mimetype) {
  if (mimetype.startsWith('image/') || mimetype.startsWith('video/')) return 'immich';
  if (mimetype.startsWith('audio/')) return 'navidrome';
  return 'filebrowser';
}

uploadRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'missing multipart field: file' });
  }

  const destination = classify(req.file.mimetype);

  try {
    if (destination === 'immich') {
      // Immich dedupes by content checksum regardless of our (always-unique)
      // deviceAssetId — a re-upload of the same bytes comes back with
      // status: 'duplicate' and the *existing* asset's id, not a new one.
      // Surface that instead of reporting it as a fresh upload.
      const asset = await uploadToImmich(req.file);
      const duplicate = asset.status === 'duplicate';
      return res.status(duplicate ? 200 : 201).json({ destination, asset, duplicate });
    }

    if (destination === 'navidrome') {
      // Navidrome has no upload API — the "upload" is dropping the file
      // into the library folder it scans, then nudging it to rescan now
      // instead of waiting for ND_SCANSCHEDULE. The spooled temp file may be
      // on a different filesystem than the music dir, so a plain rename can
      // fail with EXDEV — copy (which crosses devices) and let the finally
      // block below remove the temp original.
      const safeName = path.basename(req.file.originalname);
      const target = path.join(config.musicDir, safeName);
      await fs.copyFile(req.file.path, target, fs.constants.COPYFILE_EXCL);
      await triggerNavidromeScan();
      return res.status(201).json({ destination, path: target });
    }

    // Optional multipart field `folder` lets the caller preserve a
    // destination directory instead of always flattening to the root.
    const folder = String(req.body.folder ?? '').replace(/^\/+|\/+$/g, '');
    if (folder) {
      try {
        await createFilebrowserFolder(folder);
      } catch (folderErr) {
        // Already exists is fine (a prior upload into the same folder) —
        // anything else (permissions, backend down) should still surface.
        if (!/-> 409/.test(folderErr.message)) throw folderErr;
      }
    }
    const destPath = folder
      ? `/${folder}/${path.basename(req.file.originalname)}`
      : `/${path.basename(req.file.originalname)}`;
    await uploadToFilebrowser(req.file, destPath);
    return res.status(201).json({ destination, path: destPath });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'a file with that name already exists' });
    }
    next(err);
  } finally {
    // Always drop the spooled temp file, whether the upload succeeded, was a
    // duplicate, or threw — otherwise os.tmpdir() slowly fills up.
    if (req.file?.path) {
      await fs.rm(req.file.path, { force: true }).catch(() => {});
    }
  }
});
