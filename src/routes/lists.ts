// Route module for /lists — owned by S2-B (Phase 2).
// Auto-discovered by src/routes/index.ts; default-exports Route[].
// Also exports `listsRouter` as a named function per the S2-B contract.

import { type Route, sendJson } from '../http.js';
import { getPool } from '../db/pool.js';
import type { TodoList, CreateListBody } from '../types/contracts.js';

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getAllLists(): Promise<TodoList[]> {
  const pool = getPool();
  const result = await pool.query<TodoList>(
    'SELECT id, name, created_at FROM lists ORDER BY id ASC',
  );
  return result.rows;
}

async function createList(name: string): Promise<TodoList> {
  const pool = getPool();
  const result = await pool.query<TodoList>(
    'INSERT INTO lists (name) VALUES ($1) RETURNING id, name, created_at',
    [name],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/lists',
    handler: async (_req, res) => {
      const lists = await getAllLists();
      sendJson(res, 200, lists);
    },
  },
  {
    method: 'POST',
    path: '/lists',
    handler: async (req, res) => {
      const body = req.body as CreateListBody | undefined;
      if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const list = await createList(body.name.trim());
      sendJson(res, 201, list);
    },
  },
];

/** Named export required by S2-B contracts. Returns the lists route array. */
export function listsRouter(): Route[] {
  return routes;
}

export default routes;
