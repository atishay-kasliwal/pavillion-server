// Deployed as a Worker Route on archive.atishaykasliwal.com/*, sitting in
// front of the Cloudflare Tunnel per PLAN.md "Graceful offline state".
//
// fetch(request) here goes straight to the zone's actual origin (the
// tunnel) — Worker Routes only intercept the initial edge request, calling
// fetch() from inside a Worker does not re-enter Worker routing. So on a
// healthy origin this Worker is fully transparent; it only substitutes its
// own response when the tunnel is down (laptop off) or erroring.

const TIMEOUT_MS = 5000;

export default {
  async fetch(request) {
    try {
      const response = await fetch(request, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 500) {
        return offlineResponse();
      }
      return response;
    } catch {
      // Tunnel unreachable (origin connection failed) or timed out.
      return offlineResponse();
    }
  },
};

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '120',
    },
  });
}

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Archive unavailable</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f1115;
    color: #e6e6e6;
    text-align: center;
    padding: 1.5rem;
  }
  @media (prefers-color-scheme: light) {
    body { background: #f5f5f5; color: #1a1a1a; }
  }
  main { max-width: 28rem; }
  h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
  p { font-size: 0.95rem; line-height: 1.5; opacity: 0.75; margin: 0; }
</style>
</head>
<body>
  <main>
    <h1>Archive is offline</h1>
    <p>This is a personal archive that only runs when the home server is
       powered on. It isn't reachable right now — try again later.</p>
  </main>
</body>
</html>`;
