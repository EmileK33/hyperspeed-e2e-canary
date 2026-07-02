/**
 * S2-B — Lists route module (US-004)
 *
 * Implements:
 *   GET  /lists  → return all lists
 *   POST /lists  → create a new list
 *
 * Uses an in-memory store (no DB dependency) and self-registers its routes
 * into the shared route registry on import.
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface List {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

let _nextId = 1;
let _lists: List[] = [];

/**
 * Reset the in-memory store — useful for isolating tests.
 */
export function _resetLists(): void {
  _nextId = 1;
  _lists = [];
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/lists',
    handler: async (_req, res) => {
      sendJson(res, 200, _lists);
    },
  },
  {
    method: 'POST',
    path: '/lists',
    handler: async (req, res) => {
      const body = req.body as { name?: unknown } | null | undefined;
      if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const list: List = { id: _nextId++, name: body.name.trim() };
      _lists.push(list);
      sendJson(res, 201, list);
    },
  },
];

// ---------------------------------------------------------------------------
// Named export (contract required by other sessions)
// ---------------------------------------------------------------------------

/**
 * Returns the list of Route objects for the /lists endpoints.
 * Also re-registers them into the shared route registry (idempotent-safe
 * when used with clearRoutes() in tests).
 */
export function listsRouter(): Route[] {
  return routes;
}

// ---------------------------------------------------------------------------
// Auto-register on import (production server bootstrap)
// ---------------------------------------------------------------------------

registerRoutes(routes);

// ---------------------------------------------------------------------------
// Default export (convention for route modules)
// ---------------------------------------------------------------------------

export default routes;
