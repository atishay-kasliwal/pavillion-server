// Each client (clients/*.js) already maps its backend's response into this
// shared shape: { source, type, id, name, createdAt, size, thumbnailUrl, url }.
// This just merges the per-backend results and degrades gracefully if one
// backend is down or errors — a single slow/broken service shouldn't fail
// the whole search.
export function mergeSearchResults(settled, labels) {
  const results = [];
  const errors = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      errors.push({ source: labels[i], message: outcome.reason?.message ?? String(outcome.reason) });
    }
  });

  results.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  return { results, errors };
}
