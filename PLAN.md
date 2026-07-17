# Pavillion Server — Personal Archive Endpoint

## Motive

Repurpose a spare laptop as a personal archive for photos, music, and other
files. Not needed on a daily basis — the archive only needs to be reachable
when the laptop is intentionally powered on, not 24/7. Accessible remotely
through an admin endpoint on `atishaykasliwal.com` via Cloudflare Tunnel,
without exposing the home network or opening router ports.

## Hardware (spare laptop)

- CPU: AMD Ryzen 5 3550H, 4 cores / 8 threads
- RAM: ~6 GB (tight — the main resource constraint for this build)
- GPU: NVIDIA GTX 1050 (3 GB VRAM) + integrated Vega 8 — usable for
  accelerating ML workloads (e.g. Immich's CLIP-based photo search)
- Storage: C: 237 GB (83 GB free), D: 931 GB (516 GB free)
- Currently running Windows 11 Home

## Decisions Made So Far

1. **OS: wipe and install Ubuntu Server 24.04 LTS (headless, no GUI)**
   - Reason: with only ~6 GB RAM, Windows 11's idle footprint alone eats
     2-3 GB. Every tool in this stack is Linux-native and lighter without a
     Windows GUI on top.
   - Status: **not yet done** — this step is destructive (full wipe), so it
     happens only after this plan is confirmed.

2. **Remote access: Cloudflare Tunnel + Cloudflare Access**
   - Free tier. `cloudflared` makes an outbound connection from the laptop
     to Cloudflare — no port forwarding, router NAT not touched.
   - Cloudflare Access gates the endpoint behind auth (e.g. email OTP)
     before traffic ever reaches the laptop — a security layer on top of
     app-level auth.

3. **Application stack (all free / open-source, Docker-based):**
   - **Immich** — photo storage + gallery. Includes built-in CLIP-based
     semantic search out of the box, which covers the "vectorize the
     archive" idea for photos with no custom pipeline needed. GTX 1050 can
     accelerate its ML container via CUDA.
   - **Navidrome** — music library, Subsonic-compatible (works with most
     mobile music player apps), very light on RAM.
   - **Filebrowser** — general file archive (everything that isn't
     photos/music), minimal footprint, simple upload/download/browse UI.
   - Explicitly **not** building a separate document-vectorization/RAG
     pipeline for now — not worth the RAM pressure unless a concrete need
     for semantic search over text docs shows up later.

4. **Power/availability model: on-demand, not always-on**
   - Data isn't needed daily, so the laptop does not need to run 24/7 —
     this also avoids the wear/thermal/power concerns of continuous
     laptop uptime.
   - **Auto power-on when plugged into AC power**, if the laptop's BIOS
     supports it (setting commonly called "Power On by AC Attach" / "AC
     Recovery" / "Resume on AC"). Needs to be checked in BIOS once we're
     in there — not guaranteed on all laptop models. Fallback: manual
     power button press, same end result.
   - **Auto-start services on boot**: systemd units for Docker Compose and
     `cloudflared`, headless, no login required.
   - **Graceful offline state**: when the laptop/tunnel is down, visitors
     should not see a raw Cloudflare error page. Plan is a small
     **Cloudflare Worker** (free tier) in front of the tunnel that detects
     an unreachable origin and serves a clean "archive not available"
     message instead.

## Known Risks / Open Questions

- **No backup/redundancy yet.** This is currently a single laptop, single
  disk. If it fails, everything on it is gone. Flagged but not yet
  resolved — worth deciding whether a periodic backup to a second cheap
  location is needed, given the data is described as an "archive."
- **6 GB RAM is tight** for Immich (Postgres + Redis + ML + server) plus
  Navidrome, Filebrowser, and cloudflared running together. May need swap
  or to disable some of Immich's heavier background ML jobs if it
  struggles.
- **BIOS AC auto-power-on support unconfirmed** for this specific laptop
  model — to be checked before relying on it.
- **Cloudflare free tier** is fine for personal traffic; if large media
  files are served in bulk regularly it sits in a gray area of their ToS
  (built for web traffic, not bulk file hosting) — unlikely to be an
  issue at personal scale, just worth knowing.
- Is `atishaykasliwal.com`'s DNS already managed through Cloudflare? Not
  yet confirmed.

## Next Steps (not started yet)

- [ ] Confirm `atishaykasliwal.com` DNS is on Cloudflare
- [ ] Check BIOS for AC auto-power-on support
- [ ] Decide on backup strategy for archive data
- [ ] Wipe laptop, install Ubuntu Server 24.04 LTS
- [ ] Install Docker + Docker Compose
- [ ] Set up `cloudflared` tunnel + DNS record + systemd auto-start
- [ ] Set up Cloudflare Access in front of the tunnel
- [ ] Deploy Immich, Navidrome, Filebrowser via Docker Compose
- [ ] Configure systemd auto-start for the full stack on boot
- [ ] Build/deploy Cloudflare Worker for the "archive not available"
      fallback page
- [ ] Test end-to-end: power on → auto-start → reachable via
      `atishaykasliwal.com` → power off → clean offline message
