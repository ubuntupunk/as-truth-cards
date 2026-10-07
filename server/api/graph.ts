/**
 * `GET /api/graph` and `GET /api/graph/views`.
 *
 * A projection of `trope_graph`, computed per request. There is no graph store behind this
 * router: no Neo4j, no Gremlin, no materialised copy, no cache (issue #3 Q10). Every request
 * runs a depth-bounded Drizzle expansion and normalises the rows into
 * `trope_graph`'s own vocabulary.
 *
 * The response shape is chosen so a future Graphology or Cytoscape renderer can consume it
 * without the server learning what a renderer needs. Nodes carry ids, types, metadata, and
 * degrees; edges carry endpoints, relation words, and the vocabulary each word came from.
 * Neither leaks `trope_graph` table names as the primary contract, and neither forces a
 * client to invent a second ontology — see `trope-cards/docs/ADR_GRAPH_LAYER.md`.
 *
 * Status codes follow `docs/GRAPH_PROJECTION_DESIGN.md` §5.3: `400` malformed, `404`
 * unresolvable or view-incompatible focus, `413` past a hard cap, `500` unexpected. A
 * structurally valid view over an unpopulated corpus is `200` with `nodes: []` and a
 * `meta.warnings` entry, never an error.
 */

import { Router } from 'express';
import { DrizzleGraphReader } from '../../trope-cards/src/graph/drizzle-reader.js';
import {
  GraphFocusNotFoundError,
  projectGraph,
} from '../../trope-cards/src/graph/projection.js';
import {
  GraphQueryError,
  describeViews,
  parseGraphQuery,
  parseSearchQuery,
} from '../../trope-cards/src/graph/query.js';
import type { TropeGraphReader } from '../../trope-cards/src/graph/reader.js';

/**
 * Build the graph router.
 *
 * The Drizzle reader is constructed lazily rather than at module scope. `db/client.ts` resolves
 * a connection string and opens a pool the moment it is imported, so a module-level
 * `new DrizzleGraphReader()` would make importing this file fail in every process without a
 * database configured — a unit test, a lint pass, a future CLI. Deferring it keeps the import
 * side-effect free and means the pool is only opened by a request that actually needs one.
 *
 * @param reader Read-only Trope Graph port. Defaults to the Drizzle-backed reader; tests pass
 * a fake to exercise the route without a database.
 * @returns A configured `express` router.
 */
export function createGraphRouter(reader?: TropeGraphReader): Router {
  let resolved = reader;
  const port = (): TropeGraphReader => {
    resolved ??= new DrizzleGraphReader();
    return resolved;
  };

  const graphRouter = Router();

  graphRouter.get('/views', async (_req, res) => {
    try {
      const population = await port().readPopulation();
      res.json(describeViews(population));
    } catch (error) {
      console.error('Error reading graph view population:', error);
      res.status(500).json({
        error: 'Failed to read graph view population',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  graphRouter.get('/search', async (req, res) => {
    try {
      const { query, limit } = parseSearchQuery(
        req.query as Record<string, unknown>,
      )
      const results = await port().searchCards(query, limit)
      res.json({
        results: results.map((card) => ({
          id: card.id,
          slug: card.slug,
          title: card.title,
          summary: card.summary,
          type: 'card',
          rank: card.rank,
        })),
      })
    } catch (error) {
      if (error instanceof GraphQueryError) {
        res.status(error.status).json({ error: error.detail })
        return
      }
      console.error('Error searching cards:', error)
      res.status(500).json({
        error: 'Failed to search cards',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  })

  graphRouter.get('/', async (req, res) => {
    try {
      const request = parseGraphQuery(req.query as Record<string, unknown>);
      const projection = await projectGraph(port(), request);
      res.json(projection);
    } catch (error) {
      if (error instanceof GraphQueryError) {
        res.status(error.status).json({ error: error.detail });
        return;
      }
      if (error instanceof GraphFocusNotFoundError) {
        // 404 covers both "no such card" and "this view will not accept that focus", because
        // from the client's side both mean the requested graph does not exist.
        res.status(404).json({
          error: `Focus "${error.focus}" could not be resolved`,
          detail: error.reason,
        });
        return;
      }
      console.error('Error projecting graph:', error);
      res.status(500).json({
        error: 'Failed to project graph',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return graphRouter;
}

const router = createGraphRouter();

export default router;
