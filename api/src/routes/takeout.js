import { Router } from 'express';
import {
  listAccounts,
  createAccount,
  deleteAccount,
  getAccount,
  getStatus,
  startImport,
} from '../clients/takeout.js';

export const takeoutRouter = Router();

takeoutRouter.get('/takeout/accounts', async (_req, res, next) => {
  try {
    res.json({ accounts: await listAccounts() });
  } catch (err) {
    next(err);
  }
});

takeoutRouter.post('/takeout/accounts', async (req, res, next) => {
  try {
    const label = req.body?.label;
    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'missing required field: label' });
    }
    res.status(201).json(await createAccount(label));
  } catch (err) {
    next(err);
  }
});

takeoutRouter.delete('/takeout/accounts/:id', async (req, res, next) => {
  try {
    const removed = await deleteAccount(req.params.id);
    if (!removed) return res.status(404).json({ error: 'account not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

takeoutRouter.post('/takeout/accounts/:id/run', async (req, res, next) => {
  try {
    const account = await getAccount(req.params.id);
    if (!account) return res.status(404).json({ error: 'account not found' });
    await startImport(account);
    res.status(202).json({ status: 'running' });
  } catch (err) {
    if (/already running/.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

takeoutRouter.get('/takeout/accounts/:id/status', async (req, res, next) => {
  try {
    const account = await getAccount(req.params.id);
    if (!account) return res.status(404).json({ error: 'account not found' });
    res.json({ ...getStatus(req.params.id), lastRun: account.lastRun });
  } catch (err) {
    next(err);
  }
});
