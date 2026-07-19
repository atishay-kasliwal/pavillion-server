import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { searchRouter } from './routes/search.js';
import { uploadRouter } from './routes/upload.js';
import { mediaRouter } from './routes/media.js';
import { browseRouter } from './routes/browse.js';
import { manageRouter } from './routes/manage.js';
import { systemRouter } from './routes/system.js';
import { authRouter } from './routes/auth.js';
import { SESSION_COOKIE, getCookie, verifySessionCookieValue } from './lib/auth.js';

const app = express();

// The frontend is served same-origin from this process (see the static
// block below), so CORS normally never comes into play. It's kept for
// any cross-origin dev setup; Cloudflare Access already authenticates
// every request before it reaches this box, so this is not an auth layer.
app.use(
  cors({
    origin: config.frontendOrigins.length > 0 ? config.frontendOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());

// Cloudflare Access has already gated the request before it reaches this
// box; this is just for basic access logging, not authorization.
app.use((req, _res, next) => {
  const identity = req.headers[config.cfAccessIdentityHeader.toLowerCase()] ?? 'unknown';
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} identity=${identity}`);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Auth routes are public (login needs to be reachable while logged out);
// everything else under /api requires a valid app-level session — a second
// layer behind Cloudflare Access, not a replacement for it (see lib/auth.js).
app.use('/api', authRouter);
app.use('/api', (req, res, next) => {
  const authenticated = verifySessionCookieValue(
    getCookie(req, SESSION_COOKIE),
    config.auth.sessionSecret,
  );
  if (!authenticated) return res.status(401).json({ error: 'authentication required' });
  next();
});

app.use('/api', searchRouter);
app.use('/api', uploadRouter);
app.use('/api', mediaRouter);
app.use('/api', browseRouter);
app.use('/api', manageRouter);
app.use('/api', systemRouter);

// Serve the built SPA (frontend/ builds into api/public) same-origin, so
// one hostname and one Access session cover both UI and API. Hashed
// assets cache forever; index.html never, so deploys take effect on reload.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(
    express.static(publicDir, {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(config.port, () => {
  console.log(`archive-api listening on :${config.port}`);
});
