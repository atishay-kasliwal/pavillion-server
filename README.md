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

## The API

`GET /api/search?q=...` — aggregates search across Immich (CLIP smart
search), Navidrome (Subsonic `search3`), and Filebrowser, normalizes results
into one shape, and degrades gracefully if one backend errors.

`POST /api/upload` (multipart, field `file`) — routes by MIME type: images
and video go to Immich, audio gets dropped into the shared music directory
and triggers a Navidrome rescan, everything else goes to Filebrowser.

`GET /api/media/:source/...` — proxies thumbnails/originals/streams so the
frontend only ever talks to this API, never to backend URLs or API keys
directly.

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
