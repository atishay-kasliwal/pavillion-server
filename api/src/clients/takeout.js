// Google Photos Takeout import: account bookkeeping (persisted as a small
// JSON file inside photosDir, since that's the only volume guaranteed to
// survive a container rebuild) plus running the import script as a child
// process and tracking its live output in memory.
//
// Accounts are confined to a slug-named subfolder of takeoutDir/photosDir
// rather than accepting free-text paths from the frontend — this is an
// HTTP API, so the set of filesystem paths it can touch stays fixed
// regardless of what a client sends.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const STORE_PATH = path.join(config.photosDir, '.pavillion-takeout-accounts.json');
const IMPORT_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/import-google-takeout.js',
);

// accountId -> { status: 'running', log: string[], startedAt: string }
const jobs = new Map();
const MAX_LOG_LINES = 500;

function slugify(label) {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'account';
}

async function loadAll() {
  try {
    const raw = await fsp.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw).accounts ?? [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function saveAll(accounts) {
  await fsp.mkdir(config.photosDir, { recursive: true });
  await fsp.writeFile(STORE_PATH, JSON.stringify({ accounts }, null, 2));
}

export function srcDirFor(account) {
  return path.join(config.takeoutDir, account.slug);
}

export function destDirFor(account) {
  return path.join(config.photosDir, account.slug);
}

function withStatus(account) {
  const job = jobs.get(account.id);
  return {
    ...account,
    srcPath: srcDirFor(account),
    destPath: destDirFor(account),
    status: job?.status ?? 'idle',
  };
}

export async function listAccounts() {
  const accounts = await loadAll();
  return accounts.map(withStatus);
}

export async function createAccount(label) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('label is required');

  const accounts = await loadAll();
  const baseSlug = slugify(trimmed);
  let slug = baseSlug;
  let n = 2;
  while (accounts.some((a) => a.slug === slug)) slug = `${baseSlug}-${n++}`;

  const account = {
    id: randomUUID(),
    label: trimmed,
    slug,
    createdAt: new Date().toISOString(),
    lastRun: null,
  };

  await fsp.mkdir(srcDirFor(account), { recursive: true });
  await fsp.mkdir(destDirFor(account), { recursive: true });

  accounts.push(account);
  await saveAll(accounts);
  return withStatus(account);
}

// Only removes the tracked account entry — the downloaded zips and any
// already-imported photos on disk are left alone, since deleting someone's
// photos as a side effect of tidying up a list would be a nasty surprise.
export async function deleteAccount(id) {
  const accounts = await loadAll();
  const next = accounts.filter((a) => a.id !== id);
  if (next.length === accounts.length) return false;
  await saveAll(next);
  jobs.delete(id);
  return true;
}

export async function getAccount(id) {
  const accounts = await loadAll();
  return accounts.find((a) => a.id === id) ?? null;
}

export function getStatus(id) {
  const job = jobs.get(id);
  if (!job) return { status: 'idle', log: [] };
  return { status: job.status, log: job.log, startedAt: job.startedAt };
}

export function isAnyRunning() {
  return [...jobs.values()].some((j) => j.status === 'running');
}

export async function startImport(account) {
  if (jobs.get(account.id)?.status === 'running') {
    throw new Error('import already running for this account');
  }
  if (isAnyRunning()) {
    throw new Error('another account import is already running');
  }

  const job = { status: 'running', log: [], startedAt: new Date().toISOString() };
  jobs.set(account.id, job);

  const child = spawn(
    process.execPath,
    [IMPORT_SCRIPT, '--src', srcDirFor(account), '--dest', destDirFor(account), '--json-summary'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const appendLog = (chunk) => {
    const lines = chunk.toString('utf8').split('\n').filter(Boolean);
    job.log.push(...lines);
    if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES);
  };
  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);

  child.on('close', async (code) => {
    const resultLine = job.log.findLast?.((l) => l.startsWith('RESULT_JSON:'));
    const stats = resultLine ? JSON.parse(resultLine.slice('RESULT_JSON:'.length)) : null;

    job.status = code === 0 ? 'done' : 'error';

    const run = {
      startedAt: job.startedAt,
      finishedAt: new Date().toISOString(),
      status: code === 0 ? 'success' : 'error',
      stats,
      errorMessage: code === 0 ? null : `import script exited with code ${code}`,
    };

    const accounts = await loadAll();
    const stored = accounts.find((a) => a.id === account.id);
    if (stored) {
      stored.lastRun = run;
      await saveAll(accounts);
    }
  });

  child.on('error', (err) => {
    job.status = 'error';
    job.log.push(`failed to start import: ${err.message}`);
  });

  return job;
}

export function ensureRootDirsExist() {
  fs.mkdirSync(config.takeoutDir, { recursive: true });
  fs.mkdirSync(config.photosDir, { recursive: true });
}
