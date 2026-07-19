# Frontend — build spec

> **Superseded (2026-07-18):** the frontend is built in `frontend/` in this repo and
> is served **same-origin by archive-api itself** (Vite builds into `api/public`,
> Express serves it with an SPA fallback). Section 1's Cloudflare Pages / second
> hostname / CORS setup no longer applies — one hostname
> (`archive.atishaykasliwal.com`), one Access app, no `FRONTEND_ORIGIN` needed.
> Deploy = `npm run build` in `frontend/`, commit `api/public`, `git pull` +
> `docker compose up -d --build archive-api` on the server. The API contract in
> sections 2–5 remains authoritative. See `frontend/README.md`.

Everything needed to build the Pavillion archive frontend on a separate computer and
deploy it to Cloudflare Pages, against the `archive-api` backend that already runs on
the server. See `PLAN.md` for the overall project rationale; this file is just the
frontend's contract with the API plus the Cloudflare setup it depends on.

**Stack:** React (or similar) SPA, your choice of tooling (Vite recommended for a
static build with no server-side rendering needs — Pages serves static output).

**API base URL:** `https://archive.atishaykasliwal.com/api`

---

## 1. Cloudflare setup — do this before writing any frontend code

The frontend and the API are on different hostnames, both gated by Cloudflare Access.
**Access's session cookie has no `Domain=` attribute** (confirmed live) — it's scoped
to the exact hostname that issued it. If the frontend is served from a different
domain than `archive.atishaykasliwal.com` (e.g. the default `*.pages.dev`), the
browser will never send that cookie on cross-origin API calls, and every request will
silently hit the Access login redirect instead of the API.

**Decision made:** deploy the frontend to a subdomain of the same apex,
`app.atishaykasliwal.com`, and share one Cloudflare Access Application across both
hostnames so there's one login and one shared session. Steps, in order:

1. In Cloudflare Pages, create the project and add `app.atishaykasliwal.com` as a
   custom domain (Cloudflare adds the CNAME automatically since DNS is already on
   Cloudflare).
2. In the Zero Trust dashboard → Access → Applications, either:
   - Edit the existing Application that protects `archive.atishaykasliwal.com` and
     add `app.atishaykasliwal.com` as an additional hostname on the same app, **or**
   - Change its hostname to a wildcard, `*.atishaykasliwal.com`, if nothing else on
     this domain needs to stay unauthenticated.
3. Verify: visit `app.atishaykasliwal.com` in a browser, complete the Access login
   once, then confirm a `fetch('https://archive.atishaykasliwal.com/api/health', {credentials: 'include'})`
   from that page's devtools console succeeds without a redirect.

**On the API side**, once the frontend domain is live, set `FRONTEND_ORIGIN` in
`docker/.env` to lock CORS down (currently unset, which reflects any origin — fine
for development, not for production):

```
FRONTEND_ORIGIN=https://app.atishaykasliwal.com
```

Then `docker compose up -d archive-api` on the server to apply it (needs the person
running that command, i.e. ask when you get there).

## 2. Auth model

- Cloudflare Access gates every request before it reaches archive-api — there is no
  separate frontend-side login. Once the browser has a valid Access session (from
  step 3 above), it's carried automatically.
- **Every fetch call to the API must include `credentials: 'include'`** so the
  session cookie is sent. Without it, requests will look like they're failing with
  vague network/CORS errors even though the setup above is correct.
- If a request comes back as an HTML page (Access's login redirect) instead of JSON,
  that means the session's expired or the cookie isn't being sent — not an API bug.
- The API has no other auth of its own — `archive-api`'s only awareness of identity
  is reading (and just logging) the `Cf-Access-Authenticated-User-Email` header Access
  injects. Don't build a login form; there isn't one to build.

## 3. Response conventions

- All responses are JSON except `/api/media/*`, which streams the actual file bytes
  (image/audio/whatever the underlying asset is) with a matching `Content-Type`.
- Errors: `{ "error": "message" }` with an appropriate status code — `400` for a
  missing required field, `404`/`409` where the backend itself returns those,
  `500 { "error": "internal error" }` for anything unexpected (check server logs in
  that case, the real error isn't in the response body).
- Search/browse results that represent a single media item (not a folder, artist,
  album, etc.) share one normalized shape:

  ```ts
  type Item = {
    source: 'immich' | 'navidrome' | 'filebrowser';
    type: 'photo' | 'video' | 'audio' | 'file';
    id: string;         // opaque, backend-specific — pass back verbatim for delete/rename
    name: string;
    createdAt: string | null;   // ISO 8601
    size: number | null;        // bytes
    thumbnailUrl: string | null; // relative — prefix with the API base URL
    url: string;                 // relative — the full-quality/download/stream URL
  };
  ```

## 4. Endpoints

### Health

`GET /api/health` → `{ "ok": true }`. Useful for a startup connectivity check.

### Search (across all three backends at once)

`GET /api/search?q=<query>` →
```ts
{ query: string, count: number, results: Item[], errors: { source: string, message: string }[] }
```
`errors` lists any backend that failed for this query — the other backends' results
still come back, so a partial result set is normal, not necessarily a bug. Show a
"could not search X" indicator per source rather than failing the whole search.

### Upload

`POST /api/upload` — multipart/form-data, field `file` (required), field `folder`
(optional, Filebrowser destinations only — ignored for photos/video/audio).

Routes automatically by MIME type: `image/*` and `video/*` → Immich, `audio/*` →
Navidrome, everything else → Filebrowser. 200MB file size cap (in-memory buffering,
not spooled to disk — don't build a resumable/chunked upload flow expecting the
server to support it).

Response: `201 { destination: 'immich'|'navidrome'|'filebrowser', ...destination-specific }`.
`409 { error: "a file with that name already exists" }` if a Filebrowser destination
path collides — the frontend should let the user retry with a different name/folder
rather than treating it as fatal.

**No folder upload / drag-a-directory-in support** — one file per request. If you
want that in the UI, the frontend has to walk the dropped directory's files client-side
and call `/api/upload` once per file with the same `folder` value.

### Browse (for gallery/library views — not search)

`GET /api/browse/immich?page=1` → `{ items: Item[], nextPage: number | null }`.
Immich's full timeline, paginated. `nextPage: null` means you're on the last page.

`GET /api/browse/immich/albums` → `{ albums: { id, name, assetCount, thumbnailUrl }[] }`

`GET /api/browse/immich/albums/:id` → `{ items: Item[] }` — an album's contents.
**This is backed by Immich's search index, not a direct DB read** — there's a brief
lag between an album add/remove (below) succeeding and it showing up here. Don't
assume it's instantaneous immediately after a write; a short optimistic-UI update on
the frontend's own state is more reliable than re-fetching immediately.

`GET /api/browse/navidrome/artists` → `{ artists: { id, name, albumCount }[] }`

`GET /api/browse/navidrome/artists/:id` → `{ albums: { id, name, year, songCount, thumbnailUrl }[] }`

`GET /api/browse/navidrome/albums/:id` → `{ songs: Item[] }`

`GET /api/browse/filebrowser?path=/some/folder` (default `/`) →
```ts
{ path: string, items: { name, isDir, size, modified, path, url }[] }
```
`url` is `null` for directories. Build folder navigation by following `path` on
subsequent calls, not by string-concatenating names client-side (paths are already
normalized with a leading slash).

`POST /api/browse/filebrowser/folder` — JSON body `{ "path": "some/folder" }` →
`201 { path }`. Creates a folder ahead of time. Uploads with a `folder` field also
auto-create it, so this is only needed for an explicit "New Folder" button.

### Delete / rename / organize

`DELETE /api/immich/:id` (optional `?permanent=true`, default moves to Immich's
trash — recoverable for ~30 days, matches Immich's own UI behavior) → `204`.

Immich assets have no renameable filename — there's no rename endpoint for them.
"Organize" means albums:
- `POST /api/immich/albums` — JSON `{ name, assetIds?: string[] }` → `201`, the created
  album object (has `id`, `assetCount`, etc.)
- `PUT /api/immich/albums/:id/assets` — JSON `{ assetIds: string[] }` → `204`
- `DELETE /api/immich/albums/:id/assets` — JSON `{ assetIds: string[] }` → `204`

`DELETE /api/navidrome/:id` → `204`. `PATCH /api/navidrome/:id` — JSON
`{ "path": "new/relative/path.mp3" }` → `200 { path }`. **After a successful rename,
the song's `id` is no longer valid** — Navidrome's triggered rescan assigns the moved
file a new id. Re-fetch (e.g. re-run the album/artist browse call) before doing
anything else with that song; don't cache the old id past a rename.

`DELETE /api/filebrowser/*` (path after `/filebrowser/` is the file/folder path) →
`204`. `PATCH /api/filebrowser/*` — JSON `{ "destination": "/new/path" }` → `200 { path }`.
Same endpoint handles both rename (same folder, new name) and move (new folder) —
Filebrowser doesn't distinguish them.

### Media (thumbnails, streaming, downloads/originals)

`GET /api/media/immich/:id/thumbnail` and `GET /api/media/immich/:id/original` —
use `thumbnail` for gallery grids, `original` for full view/download.

`GET /api/media/navidrome/:id/cover` and `GET /api/media/navidrome/:id/stream` —
`stream` is safe to use directly as an `<audio>` tag's `src`.

`GET /api/media/filebrowser/*` — path after `/filebrowser/` is the file's path
(matches what browse/search return in `Item.url`, which already includes this prefix
— don't reconstruct it manually, just use `Item.url`/`thumbnailUrl` as given, prefixed
with the API base URL).

## 5. Suggested screens (not prescriptive — just what the API naturally supports)

- **Gallery** — Immich timeline (`/browse/immich`, paginated) as the default photo view
- **Albums** — list (`/browse/immich/albums`) → album detail (`/browse/immich/albums/:id`)
- **Music library** — artists → albums → songs, using the three Navidrome browse
  endpoints in sequence; a persistent mini-player using `/media/navidrome/:id/stream`
- **Files** — folder tree/breadcrumb view using `/browse/filebrowser`, with
  create-folder/rename/delete/move actions wired to the manage endpoints
- **Search** — a single search box hitting `/api/search`, results grouped or tagged
  by `source`
- **Upload** — drag-and-drop or file picker → `/api/upload`; if targeting Filebrowser,
  a folder picker/breadcrumb reusing the same browse state as the Files screen

## 6. Open questions to resolve before/while building

- [ ] Cloudflare Pages project created, `app.atishaykasliwal.com` added as custom domain
- [ ] Access Application updated to cover both hostnames (or wildcarded)
- [ ] `FRONTEND_ORIGIN` set in `docker/.env` on the server once the domain is live
- [ ] Design/visual direction — nothing decided yet, wide open
- [ ] Whether album/playlist creation needs a dedicated UI now or can wait
- [ ] Whether Immich's ML features (semantic search, faces) get turned on later — if
      so, `/api/search` already uses Immich's smart search transparently, no frontend
      change needed when that flag flips server-side
