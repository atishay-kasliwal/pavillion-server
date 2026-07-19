function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8090),
  musicDir: process.env.MUSIC_DIR ?? '/music',
  cfAccessIdentityHeader:
    process.env.CF_ACCESS_IDENTITY_HEADER ?? 'Cf-Access-Authenticated-User-Email',
  // Comma-separated list of origins allowed to call this API cross-origin
  // (the Cloudflare Pages frontend domain, plus localhost for local dev).
  // Empty means "reflect any origin" — fine while no frontend is deployed
  // yet, but should be locked down once FRONTEND_ORIGIN is known.
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  immich: {
    baseUrl: required('IMMICH_BASE_URL', 'http://localhost:2283'),
    apiKey: required('IMMICH_API_KEY', ''),
  },
  navidrome: {
    baseUrl: required('NAVIDROME_BASE_URL', 'http://localhost:4533'),
    username: required('NAVIDROME_USERNAME', ''),
    password: required('NAVIDROME_PASSWORD', ''),
  },
  filebrowser: {
    baseUrl: required('FILEBROWSER_BASE_URL', 'http://localhost:8091'),
    username: required('FILEBROWSER_USERNAME', ''),
    password: required('FILEBROWSER_PASSWORD', ''),
  },

  // App-level login (see routes/auth.js) — a second layer behind Cloudflare
  // Access, not a replacement for it. passwordHash is `salt:hash` hex from
  // scripts/hash-password.js. Left blank means login can never succeed
  // (fails closed) rather than silently accepting any password.
  auth: {
    username: process.env.APP_LOGIN_USERNAME ?? '',
    passwordHash: process.env.APP_LOGIN_PASSWORD_HASH ?? '',
    sessionSecret: process.env.SESSION_SECRET ?? '',
  },

  // Large uploads (>100 MB) can't go through Cloudflare (100 MB body cap), so
  // they take a direct-to-box path over the tailnet instead (Tailscale HTTPS).
  // That cross-domain request never carries the app-session cookie, so the
  // upload route accepts this key in its place FOR UPLOADS ONLY. The key is
  // baked into the public frontend bundle and is NOT a secret on its own — the
  // real boundary is that the direct-upload origin is reachable only over the
  // private tailnet (UFW-scoped to tailscale0). Blank disables the bypass.
  directUploadKey: process.env.UPLOAD_DIRECT_KEY ?? '',
};
