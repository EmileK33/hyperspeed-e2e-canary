/**
 * Lists route module — US-004.
 *
 * GET  /lists  → return all lists
 * POST /lists  → create a new list
 *
 * Default-exports a Route[] auto-discovered by the route registry.
 * Also named-exports `listsRouter` for consumers that reference it directly.
 */

import { type Route } from '../server/app.ts';

/** Core list entity. */
interface List {
  id: number;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// In-memory store (no DB session owns a lists store yet)
// ---------------------------------------------------------------------------

let nextId = 1;
const lists: List[] = [];

function getAllLists(): List[] {
  return [...lists];
}

function createList(name: string): List {
  const list: List = {
    id: nextId++,
    name,
    created_at: new Date().toISOString(),
  };
  lists.push(list);
  return list;
}

/** Resets the in-memory store — used by tests. */
export function _resetStore(): void {
  lists.length = 0;
  nextId = 1;
}

// ---------------------------------------------------------------------------
// Helper — send JSON
// ---------------------------------------------------------------------------

import type { ServerResponse } from 'node:http';

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/lists',
    handler: (_req, res) => {
      sendJson(res, 200, getAllLists());
    },
  },
  {
    method: 'POST',
    path: '/lists',
    handler: (req, res) => {
      const body = req.body as { name?: string } | undefined;
      const name = body?.name;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        sendJson(res, 400, { error: 'name is required' });
        return;
      }
      const list = createList(name.trim());
      sendJson(res, 201, list);
    },
  },
];

export default routes;

/**
 * Named export consumed by other sessions / the route registry.
 * Returns the Route[] for this module.
 */
export function listsRouter(): Route[] {
  return routes;
}
