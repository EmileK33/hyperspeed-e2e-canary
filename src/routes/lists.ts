// src/routes/lists.ts
//
// Route module for /lists endpoints (US-004).
// Auto-discovered by src/routes/index.ts — default-exports Route[].
// Also exports `listsRouter` as a named function for consumers.

import { type Route, sendJson } from '../http.js';
import { getPool } from '../db/pool.js';
import type { List } from '../types/contracts.js';

// ---------------------------------------------------------------------------
// Store helpers (inline — no separate store file in this session's scope)
// ---------------------------------------------------------------------------

async function listAll(): Promise<List[]> {
  const pool = await getPool();
  const result = await pool.query<List>(
    'SELECT id, name, created_at FROM lists ORDER BY created_at ASC',
  );
  return result.rows;
}

async function createList(name: string): Promise<List> {
  const pool = await getPool();
  const result = await pool.query<List>(
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
      const lists = await listAll();
      sendJson(res, 200, lists);
    },
  },
  {
    method: 'POST',
    path: '/lists',
    handler: async (req, res) => {
      const body = req.body as { name?: unknown } | undefined;
      const name = body?.name;
      if (typeof name !== 'string' || !name.trim()) {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const created = await createList(name.trim());
      sendJson(res, 201, created);
    },
  },
];

/** Named export consumed by other sessions. Returns the lists Route[]. */
export function listsRouter(): Route[] {
  return routes;
}

export default routes;
