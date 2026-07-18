import express from 'express';
import { config } from './config.js';
import { searchRouter } from './routes/search.js';
import { uploadRouter } from './routes/upload.js';
import { mediaRouter } from './routes/media.js';

const app = express();

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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(config.port, () => {
  console.log(`archive-api listening on :${config.port}`);
});
