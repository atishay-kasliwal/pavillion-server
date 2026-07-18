import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { uploadToImmich } from '../clients/immich.js';
import { triggerNavidromeScan } from '../clients/navidrome.js';
import { uploadToFilebrowser, createFilebrowserFolder } from '../clients/filebrowser.js';

export const uploadRouter = Router();

// Keep the API stateless/light: files are buffered in memory rather than
// spooled to disk, and the 200 MB cap keeps a single upload from pressuring
// the ~6 GB RAM budget (see PLAN.md "Known Risks").
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

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
      const asset = await uploadToImmich(req.file);
      return res.status(201).json({ destination, asset });
    }

    if (destination === 'navidrome') {
      // Navidrome has no upload API — the "upload" is dropping the file
      // into the library folder it scans, then nudging it to rescan now
      // instead of waiting for ND_SCANSCHEDULE.
      const safeName = path.basename(req.file.originalname);
      const target = path.join(config.musicDir, safeName);
      await fs.writeFile(target, req.file.buffer, { flag: 'wx' });
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
  }
});
