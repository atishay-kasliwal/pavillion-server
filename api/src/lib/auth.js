// App-level login: a second auth layer behind Cloudflare Access, not a
// replacement for it. Single shared credential (no user table needed) —
// password is verified against a scrypt hash, sessions are a signed,
// stateless cookie (no session store needed for one user).

import crypto from 'node:crypto';

export const SESSION_COOKIE = 'pavillion_auth';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function verifyPassword(password, storedHash) {
  const [salt, hashHex] = (storedHash || '').split(':');
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
}

export function createSessionCookieValue(secret) {
  const expires = String(Date.now() + SESSION_MAX_AGE_MS);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifySessionCookieValue(cookieValue, secret) {
  if (!cookieValue || !secret) return false;
  const [expires, sig] = cookieValue.split('.');
  if (!expires || !sig || !timingSafeEqualHex(sig, sign(expires, secret))) return false;
  const expiresAt = Number(expires);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function setCookie(res, name, value, { maxAgeMs, secure }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeMs) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Max-Age=0`);
}

export { SESSION_MAX_AGE_MS };
