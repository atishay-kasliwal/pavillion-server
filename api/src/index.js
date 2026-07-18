import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { searchRouter } from './routes/search.js';
import { uploadRouter } from './routes/upload.js';
import { mediaRouter } from './routes/media.js';
import { browseRouter } from './routes/browse.js';
import { manageRouter } from './routes/manage.js';

const app = express();

// The frontend is deployed on a different origin (Cloudflare Pages), so
// the browser enforces CORS on every call here. Cloudflare Access already
// authenticates the request before it reaches this box (see below), so
// this is just what makes cross-origin fetch() calls possible at all —
// not a second auth layer. Empty FRONTEND_ORIGIN (no frontend deployed
// yet) reflects any origin; set it once the frontend's real origin is
// known to lock this down.
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

app.use('/api', searchRouter);
app.use('/api', uploadRouter);
app.use('/api', mediaRouter);
app.use('/api', browseRouter);
app.use('/api', manageRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(config.port, () => {
  console.log(`archive-api listening on :${config.port}`);
});
