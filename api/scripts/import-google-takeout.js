#!/usr/bin/env node
// One-time bulk import of a Google Takeout "Google Photos" export into a
// plain directory on disk, organized by <dest>/<yyyy>/<mm>/<filename>.
//
// Takeout quirks this handles:
//  - Input may be a folder of .zip exports, an already-extracted folder,
//    or a mix of both — zips are extracted to a staging dir first.
//  - Each media file normally has a sidecar `<name>.<ext>.json` with the
//    real "photo taken" time; Google truncates/reshuffles that sidecar
//    name when the path gets long (e.g. `img(1).jpg` -> `img.jpg(1).json`),
//    so a couple of fallback patterns are tried before giving up.
//  - Files with no matching sidecar still get imported, just filed under
//    their filesystem mtime instead of the real capture time.
//  - Re-running the script is safe: files already present at the
//    destination (same name + size) are skipped rather than duplicated.
//
// Usage:
//   node scripts/import-google-takeout.js --src <dir> --dest <dir> [--dry-run]
//
// --src can also be set via TAKEOUT_SRC_DIR, --dest via PHOTOS_DEST_DIR.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.gif', '.webp',
  '.tif', '.tiff', '.bmp', '.raw', '.cr2', '.nef', '.dng', '.arw',
  '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.3gp', '.webm',
]);

function parseArgs(argv) {
  const args = { dryRun: false, jsonSummary: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') args.src = argv[++i];
    else if (a === '--dest') args.dest = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    // Emits a final `RESULT_JSON:{...}` line so a caller (e.g. the archive
    // API, which spawns this script as a child process) can parse the
    // outcome reliably instead of scraping the human-readable summary.
    else if (a === '--json-summary') args.jsonSummary = true;
  }
  args.src = args.src ?? process.env.TAKEOUT_SRC_DIR;
  args.dest = args.dest ?? process.env.PHOTOS_DEST_DIR;
  if (!args.src || !args.dest) {
    throw new Error('Usage: import-google-takeout.js --src <dir> --dest <dir> [--dry-run]');
  }
  return args;
}

async function findZips(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.zip'))
    .map((e) => path.join(dir, e.name));
}

async function extractZips(zips, stagingDir) {
  await fsp.mkdir(stagingDir, { recursive: true });
  for (const zip of zips) {
    console.log(`extracting ${path.basename(zip)}...`);
    await execFileAsync('unzip', ['-q', '-n', zip, '-d', stagingDir]);
  }
}

async function* walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// Takeout's sidecar-JSON naming is inconsistent once paths get long, so a
// few known-truncated variants are tried before giving up on metadata.
function candidateSidecarPaths(mediaPath) {
  const dir = path.dirname(mediaPath);
  const base = path.basename(mediaPath);
  const candidates = [`${base}.json`];

  const suffixMatch = base.match(/^(.*)(\(\d+\))(\.[^.]+)$/);
  if (suffixMatch) {
    const [, stem, suffix, ext] = suffixMatch;
    candidates.push(`${stem}${ext}${suffix}.json`);
  }

  // Google also truncates long base names to keep the sidecar under the
  // filesystem's path limit; try a handful of shortened lengths.
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length);
  for (const len of [47, 46, 45, 30]) {
    if (stem.length > len) {
      candidates.push(`${stem.slice(0, len)}${ext}.json`);
    }
  }

  return [...new Set(candidates)].map((name) => path.join(dir, name));
}

async function readTakenTime(mediaPath) {
  for (const candidate of candidateSidecarPaths(mediaPath)) {
    try {
      const raw = await fsp.readFile(candidate, 'utf8');
      const meta = JSON.parse(raw);
      const ts = Number(meta.photoTakenTime?.timestamp ?? meta.creationTime?.timestamp);
      if (Number.isFinite(ts) && ts > 0) return new Date(ts * 1000);
    } catch {
      // try next candidate / fall through to mtime
    }
  }
  return null;
}

async function sha1(filePath) {
  const hash = crypto.createHash('sha1');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function resolveDestPath(destDir, filename, srcPath) {
  let candidate = path.join(destDir, filename);
  let n = 1;
  const ext = path.extname(filename);
  const stem = filename.slice(0, -ext.length);

  while (true) {
    let existingStat;
    try {
      existingStat = await fsp.stat(candidate);
    } catch {
      return { destPath: candidate, isDuplicate: false };
    }

    const srcStat = await fsp.stat(srcPath);
    if (existingStat.size === srcStat.size && (await sha1(candidate)) === (await sha1(srcPath))) {
      return { destPath: candidate, isDuplicate: true };
    }

    n += 1;
    candidate = path.join(destDir, `${stem}-${n}${ext}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const src = path.resolve(args.src);
  const dest = path.resolve(args.dest);

  const zips = await findZips(src);
  let scanDir = src;
  if (zips.length > 0) {
    const stagingDir = path.join(src, '.extracted');
    await extractZips(zips, stagingDir);
    scanDir = stagingDir;
  }

  const stats = { imported: 0, duplicates: 0, missingMetadata: 0, errors: 0 };

  for await (const filePath of walk(scanDir)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) continue;

    try {
      const takenAt = await readTakenTime(filePath);
      if (!takenAt) stats.missingMetadata += 1;
      const when = takenAt ?? (await fsp.stat(filePath)).mtime;

      const yyyy = String(when.getFullYear());
      const mm = String(when.getMonth() + 1).padStart(2, '0');
      const destDir = path.join(dest, yyyy, mm);

      const filename = path.basename(filePath);

      if (args.dryRun) {
        console.log(`[dry-run] ${filePath} -> ${path.join(destDir, filename)}`);
        stats.imported += 1;
        continue;
      }

      await fsp.mkdir(destDir, { recursive: true });
      const { destPath, isDuplicate } = await resolveDestPath(destDir, filename, filePath);

      if (isDuplicate) {
        stats.duplicates += 1;
        continue;
      }

      await fsp.copyFile(filePath, destPath);
      await fsp.utimes(destPath, when, when);
      stats.imported += 1;
    } catch (err) {
      stats.errors += 1;
      console.error(`error processing ${filePath}: ${err.message}`);
    }
  }

  console.log('\ndone.');
  console.log(`  imported:         ${stats.imported}`);
  console.log(`  skipped (dupes):  ${stats.duplicates}`);
  console.log(`  missing metadata: ${stats.missingMetadata} (filed under file mtime instead)`);
  console.log(`  errors:           ${stats.errors}`);

  if (args.jsonSummary) {
    console.log(`RESULT_JSON:${JSON.stringify(stats)}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
