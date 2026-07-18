import { Router } from 'express';
import { searchImmich } from '../clients/immich.js';
import { searchNavidrome } from '../clients/navidrome.js';
import { searchFilebrowser } from '../clients/filebrowser.js';
import { mergeSearchResults } from '../normalize.js';

export const searchRouter = Router();

const SOURCES = ['immich', 'navidrome', 'filebrowser'];

searchRouter.get('/search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) {
    return res.status(400).json({ error: 'missing required query param: q' });
  }

  const settled = await Promise.allSettled([
    searchImmich(query),
    searchNavidrome(query),
    searchFilebrowser(query),
  ]);

  const { results, errors } = mergeSearchResults(settled, SOURCES);
  res.json({ query, count: results.length, results, errors });
});
