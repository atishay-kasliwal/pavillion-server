import { Router } from 'express';
import { config } from '../config.js';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  clearCookie,
  createSessionCookieValue,
  getCookie,
  setCookie,
  verifyPassword,
  verifySessionCookieValue,
} from '../lib/auth.js';

export const authRouter = Router();

function isHttps(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

authRouter.get('/auth/status', (req, res) => {
  const authenticated = verifySessionCookieValue(
    getCookie(req, SESSION_COOKIE),
    config.auth.sessionSecret,
  );
  res.json({ authenticated });
});

authRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== config.auth.username ||
    !verifyPassword(password, config.auth.passwordHash)
  ) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  setCookie(res, SESSION_COOKIE, createSessionCookieValue(config.auth.sessionSecret), {
    maxAgeMs: SESSION_MAX_AGE_MS,
    secure: isHttps(req),
  });
  res.json({ ok: true });
});

authRouter.post('/auth/logout', (_req, res) => {
  clearCookie(res, SESSION_COOKIE);
  res.status(204).end();
});
