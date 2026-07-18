# Pavillion Server

Personal archive endpoint — see [PLAN.md](PLAN.md) for the full design and
rationale. This README covers what's in this repo and how to stand it up.

## Layout

```
docker/       docker-compose.yml for Immich + Navidrome + Filebrowser + the
              custom API, and .env.example for all the config it needs
api/          the custom API service (Node/Express) — search aggregation,
              upload proxy, and media proxying across the three backends
cloudflared/  config.yml.example for the Cloudflare Tunnel
systemd/      unit files for booting the stack and the tunnel headlessly
worker/       Cloudflare Worker that serves a clean "offline" page when
              the tunnel/laptop is down
```

## What's done here vs. what still needs your hands

This repo only contains software that can be written and tested without
touching the physical laptop or your Cloudflare account. The following are
**not done** and need to happen on your end, in roughly this order:

1. Confirm `atishaykasliwal.com` DNS is on Cloudflare.
2. Check the laptop's BIOS for AC auto-power-on support.
3. Decide on a backup strategy for the archive data (currently none —
   single laptop, single disk, see PLAN.md "Known Risks").
4. Wipe the laptop and install Ubuntu Server 24.04 LTS.
5. `curl -fsSL https://get.docker.com | sh` (or your preferred Docker
   install) on the server.
6. Clone this repo onto the server, e.g. at `/opt/pavillion-server`.
7. `cp docker/.env.example docker/.env` and fill in real values (DB
   password, mount paths for your D: drive data, Immich API key — generate
   that last one from the Immich admin UI after first boot).
8. `cloudflared tunnel login && cloudflared tunnel create pavillion &&
   cloudflared tunnel route dns pavillion archive.atishaykasliwal.com`,
   then `cp cloudflared/config.yml.example /etc/cloudflared/config.yml`
   and fill in the tunnel ID.
9. Set up Cloudflare Access in front of `archive.atishaykasliwal.com`
   (Zero Trust dashboard → Access → Applications).
10. Install the systemd units (see comments at the top of each file in
    `systemd/`) so the stack and tunnel start on boot.
11. `cd worker && cp wrangler.toml.example wrangler.toml`, fill in your
    account ID, `wrangler deploy`.
12. Build/deploy the frontend separately (per PLAN.md, on another machine)
    against this API, publish to Cloudflare Pages.

## Running the stack

```
cd docker
cp .env.example .env   # fill in real values first
docker compose up -d              # without Immich's ML features
docker compose --profile ml up -d # with CLIP search / face detection
```

Immich, Navidrome, and Filebrowser bind to `127.0.0.1` only — nothing is
exposed off-box except `archive-api`, which is what the tunnel points at.

### Direct native-app access over Tailscale

Immich's own mobile app (camera-roll auto-backup) needs to reach Immich
directly — it doesn't go through archive-api. Rather than expose it
publicly, Immich is *also* bound to this machine's Tailscale IP
(`TAILSCALE_IP` in `.env`), with a UFW rule scoped to just the
`tailscale0` interface (`sudo ufw status` shows it as `2283/tcp on
tailscale0`) — so it's reachable from your own devices over the tailnet,
but not from the LAN or public internet.

To set up the mobile app: install Tailscale on the phone, log into the
same tailnet, install the Immich app, and set the server URL to
`http://<TAILSCALE_IP>:2283`. Log in with the existing Immich account.
Enable background/camera-roll backup in the app's settings.

The same pattern (extra port binding + a `ufw allow ... on tailscale0`
rule) can be applied to Navidrome (4533) or Filebrowser (8091) later if
native-app access to those is wanted too — nobody's asked for that yet,
so it isn't done.

## The API

`GET /api/search?q=...` — aggregates search across Immich (CLIP smart
search), Navidrome (Subsonic `search3`), and Filebrowser, normalizes results
into one shape, and degrades gracefully if one backend errors.

`POST /api/upload` (multipart, field `file`, optional field `folder` for
Filebrowser destinations) — routes by MIME type: images and video go to
Immich, audio gets dropped into the shared music directory and triggers a
Navidrome rescan, everything else goes to Filebrowser (preserving `folder`
as a subdirectory if given, created automatically if it doesn't exist yet).

`GET /api/media/:source/...` — proxies thumbnails/originals/streams so the
frontend only ever talks to this API, never to backend URLs or API keys
directly.

`GET /api/browse/immich?page=` — timeline (all assets, paginated,
newest-first-ish per Immich's own ordering), for a gallery view instead of
requiring a search query.

`GET /api/browse/immich/albums` / `GET /api/browse/immich/albums/:id` —
list albums, then list the assets inside one.

`GET /api/browse/navidrome/artists` / `.../artists/:id` / `.../albums/:id`
— library browse: artists → an artist's albums → an album's songs.

`GET /api/browse/filebrowser?path=/some/folder` — list a directory's
immediate contents (files + subfolders).

`POST /api/browse/filebrowser/folder` (JSON body `{ "path": "..." }`) —
create a folder ahead of time (uploads also auto-create their destination
folder if it doesn't exist).

CORS: set `FRONTEND_ORIGIN` (comma-separated) to the frontend's real
origin once it's deployed — the API reflects any origin until then, which
is fine for development but should be locked down for production.

### Delete / rename / organize

`DELETE /api/immich/:id` (optional `?permanent=true`, default moves to
Immich's trash) — Immich assets have no renameable filename, so there's
no rename route for them; organizing means albums instead:

- `POST /api/immich/albums` (JSON `{ name, assetIds? }`) — create an album
- `PUT /api/immich/albums/:id/assets` (JSON `{ assetIds }`) — add assets
- `DELETE /api/immich/albums/:id/assets` (JSON `{ assetIds }`) — remove assets

`DELETE /api/navidrome/:id` / `PATCH /api/navidrome/:id` (JSON `{ path }`)
— Navidrome/Subsonic has no write API at all, so these resolve the song's
real path on disk (via Navidrome's native `/api/song/:id` — **not**
Subsonic's `getSong`, whose `path` field is a virtualized
"Artist/Album/Title" display path that doesn't match the real file
location for untagged/mistagged audio, confirmed live) and delete/move
the file directly in the shared music folder, then trigger a rescan so
Navidrome's index catches up — the same trick `/api/upload` already uses.
**After a successful rename, the old song ID is stale** — the rescan
assigns the moved file a new ID, so re-fetch (e.g. via `/api/browse/navidrome/...`)
before doing anything else with that song.

`DELETE /api/filebrowser/*` / `PATCH /api/filebrowser/*` (JSON
`{ destination }`) — native Filebrowser delete/rename/move.

Note: `GET /api/browse/immich/albums/:id` (and Immich browsing generally)
is backed by Immich's search index, not a direct DB read — observed a
brief lag between an album add/remove succeeding (204) and it showing up
in a browse call right after. Don't assume the browse result is
instantaneous truth immediately following a write.

See `api/.env.example` for the env vars it needs (all supplied via
`docker/.env` when run through Compose).

## Local dev on the API

```
cd api
npm install
cp .env.example .env   # point at real or locally-running backends
npm run dev
curl localhost:8090/api/health
```
