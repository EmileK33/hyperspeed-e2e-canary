/**
 * Lists routes — US-004
 *
 * GET  /lists  → return all named lists
 * POST /lists  → create a named list, return 201 with the created row
 *
 * Owned by S2-B. Default-exports a Route[] for auto-discovery; also exports
 * the named `listsRouter` function consumed by sibling sessions.
 */

import { type Route, sendJson } from '../http.js';
import { getPool } from '../db/pool.js';
import type { TodoList } from '../types/contracts.js';

// ── Store helpers ─────────────────────────────────────────────────────────────

async function getAllLists(): Promise<TodoList[]> {
  const pool = await getPool();
  const result = await pool.query<TodoList>(
    'SELECT id, name FROM lists ORDER BY id ASC',
  );
  return result.rows;
}

async function createList(name: string): Promise<TodoList> {
  const pool = await getPool();
  const result = await pool.query<TodoList>(
    'INSERT INTO lists (name) VALUES ($1) RETURNING id, name',
    [name],
  );
  const row = result.rows[0];
  if (!row) throw new Error('INSERT did not return a row');
  return row;
}

// ── Routes ────────────────────────────────────────────────────────────────────

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
      const body = req.body as { name?: unknown } | undefined;
      const name = body?.name;
      if (typeof name !== 'string' || name.trim() === '') {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const created = await createList(name.trim());
      sendJson(res, 201, created);
    },
  },
];

export default routes;

/** Named export consumed by sibling sessions. Returns the list of routes. */
export function listsRouter(): Route[] {
  return routes;
}
