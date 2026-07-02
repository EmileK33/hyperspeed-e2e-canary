/**
 * Lists route module — US-004
 *
 * Implements:
 *   GET  /lists  → return all lists
 *   POST /lists  → create a named list, returns 201
 *
 * In-memory store (no Postgres schema for lists in this phase).
 * Self-registers via `registerRoutes` so the server picks it up automatically.
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';
import type { List } from '../types/contracts.ts';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const _lists: List[] = [];
let _nextId = 1;

/** Reset state — exposed for testing. */
export function _resetLists(): void {
  _lists.length = 0;
  _nextId = 1;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/lists',
    handler: async (_req, res, _params) => {
      sendJson(res, 200, _lists);
    },
  },
  {
    method: 'POST',
    path: '/lists',
    handler: async (req, res, _params) => {
      const body = req.body as Record<string, unknown> | null | undefined;
      const name = body?.name;

      if (typeof name !== 'string' || name.trim() === '') {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }

      const list: List = { id: _nextId++, name: name.trim() };
      _lists.push(list);
      sendJson(res, 201, list);
    },
  },
];

// Self-register so the server dispatches these routes at startup.
registerRoutes(routes);

export default routes;

/**
 * Named export required by the build graph contract.
 * Returns the Route[] for consumers that prefer a function interface.
 */
export function listsRouter(): Route[] {
  return routes;
}
