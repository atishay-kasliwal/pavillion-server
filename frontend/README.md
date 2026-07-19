# Pavillion frontend

React + Vite + TypeScript SPA for the Pavillion archive, themed to match the
Atriveo dark theme (ported from atriveo-app's `src/index.css`). Served
**same-origin by archive-api** at `https://archive.atishaykasliwal.com` — the
API and the UI share one hostname, one Cloudflare Access login, and zero CORS
configuration. See `../FRONTEND.md` for the API contract.

## Local development

```
npm install
npm run dev     # http://localhost:5173
```

The dev server proxies `/api/*` to the real API through Cloudflare Access.
For that to work you need an Access **service token**:

1. Zero Trust dashboard → Access → Service Auth → create a token (e.g. `pavillion-dev`)
2. On the Access Application protecting `archive.atishaykasliwal.com`, add a
   **Service Auth** policy that includes that token
3. Create `frontend/.env.local` (gitignored):

   ```
   CF_ACCESS_CLIENT_ID=xxxx.access
   CF_ACCESS_CLIENT_SECRET=yyyy
   ```

4. Restart `npm run dev`

Without the token, the UI shell still renders but every API call gets Access's
login redirect (you'll see "api offline" in the sidebar).

**Heads up:** dev talks to the production data. Deletes are real — Immich
deletes default to trash (recoverable ~30 days), but Navidrome/Filebrowser
deletes are permanent.

## Deploy

```
npm run build   # outputs into ../api/public (committed to git)
```

Then commit `api/public` and push. On the server:

```
git pull
cd docker && docker compose up -d --build archive-api
```

The API serves the built SPA with an SPA fallback (deep links work) and
immutable caching for hashed assets. No Cloudflare Pages, no `FRONTEND_ORIGIN`,
no extra hostname — Cloudflare Access on `archive.atishaykasliwal.com` covers
everything.
