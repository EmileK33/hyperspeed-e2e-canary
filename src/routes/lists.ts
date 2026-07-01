/**
 * Lists route module — US-004 Saved lists.
 * Implements GET /lists and POST /lists with an in-memory store.
 * S2-B: list
 */

import { type Route, sendJson } from '../http.js';
import { registerRoutes } from './index.js';
import type { TodoList } from '../types/contracts.js';

// ---------------------------------------------------------------------------
// In-memory lists store
// ---------------------------------------------------------------------------

let _nextId = 1;
const _lists: TodoList[] = [];

/** Reset store — useful for test isolation. */
export function resetLists(): void {
  _lists.length = 0;
  _nextId = 1;
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
      const body = req.body as Record<string, unknown> | undefined;
      const name = body?.name;
      if (typeof name !== 'string' || name.trim() === '') {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const list: TodoList = {
        id: _nextId++,
        name: name.trim(),
        created_at: new Date().toISOString(),
      };
      _lists.push(list);
      sendJson(res, 201, list);
    },
  },
];

// Register with the global registry so the app auto-discovers these routes.
registerRoutes(routes);

/**
 * Returns the Route[] for this module.
 * Other sessions may import this to mount the routes in a test server.
 */
export function listsRouter(): Route[] {
  return routes;
}

export default routes;
