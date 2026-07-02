/**
 * S2-D independent test — todo endpoints (US-003)
 *
 * Starts a real node:http server on an ephemeral port.
 * Uses _setPool to inject an in-memory mock so no Postgres instance is needed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes } from '../src/routes/index.ts';
import { _setPool } from '../src/db/pool.ts';
import type { Pool, QueryResult, Row } from '../src/db/pool.ts';

// Import the todos route to trigger self-registration.
import '../src/routes/todos.ts';

// ---------------------------------------------------------------------------
// In-memory mock pool
// ---------------------------------------------------------------------------

interface TodoRow extends Row {
  id: number;
  title: string;
  done: boolean;
}

function createMockPool(): Pool {
  const rows: TodoRow[] = [];
  let nextId = 1;

  return {
    query: async <R extends Row = Row>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>> => {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith('INSERT INTO TODOS')) {
        const title = values?.[0] as string;
        const row: TodoRow = { id: nextId++, title, done: false };
        rows.push(row);
        return { rows: [row] as unknown as R[], rowCount: 1 };
      }

      if (sql.startsWith('SELECT') && sql.includes('WHERE ID = $1')) {
        const id = Number(values?.[0]);
        const found = rows.find((r) => r.id === id);
        return {
          rows: found ? ([found] as unknown as R[]) : [],
          rowCount: found ? 1 : 0,
        };
      }

      if (sql.startsWith('SELECT')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as R[], rowCount: sorted.length };
      }

      if (sql.startsWith('UPDATE TODOS')) {
        const id = Number(values?.[0]);
        const row = rows.find((r) => r.id === id);
        if (!row) return { rows: [], rowCount: 0 };
        row.done = !row.done;
        return { rows: [row] as unknown as R[], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

async function startServer(): Promise<{ url: string; close: () => void }> {
  const server = await createServer();
  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, resolve);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address = (server as any).address();
  const port: number = address?.port ?? 0;
  const url = `http://localhost:${port}`;
  const close = () => {
    (server as unknown as { close(): void }).close();
  };
  return { url, close };
}

// ---------------------------------------------------------------------------
// Export contract
// ---------------------------------------------------------------------------

describe('src/routes/todos.ts — export contract', () => {
  it('exports todosRouter as a function', async () => {
    const mod = await import('../src/routes/todos.ts');
    expect(typeof mod.todosRouter).toBe('function');
  });

  it('todosRouter() returns a non-empty Route array', async () => {
    const mod = await import('../src/routes/todos.ts');
    const routes = mod.todosRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// US-003 — Todo CRUD endpoints
// ---------------------------------------------------------------------------

describe('US-003 — /todos endpoints', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    _setPool(createMockPool());
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
    _setPool(null);
  });

  // ---- GET /todos ----

  it('GET /todos returns 200 with an empty array initially', async () => {
    const res = await fetch(`${url}/todos`);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('GET /todos sets Content-Type: application/json', async () => {
    const res = await fetch(`${url}/todos`);
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  // ---- POST /todos ----

  it('POST /todos returns 201 with the created todo', async () => {
    const res = await fetch(`${url}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk' }),
    });
    expect(res.status).toBe(201);
    const todo = await res.json() as { id: number; title: string; done: boolean };
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
    expect(typeof todo.id).toBe('number');
  });

  it('POST /todos returns 400 when title is missing', async () => {
    const res = await fetch(`${url}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /todos returns 400 when title is empty string', async () => {
    const res = await fetch(`${url}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /todos lists all created todos', async () => {
    // Create a second one
    await fetch(`${url}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Walk dog' }),
    });
    const res = await fetch(`${url}/todos`);
    const todos = await res.json() as { title: string }[];
    // At least the two we just created (pool was set before all tests)
    expect(todos.length).toBeGreaterThanOrEqual(2);
    const titles = todos.map((t) => t.title);
    expect(titles).toContain('Buy milk');
    expect(titles).toContain('Walk dog');
  });

  // ---- POST /todos/:id/toggle ----

  it('POST /todos/:id/toggle flips done to true', async () => {
    // Create a fresh todo
    const createRes = await fetch(`${url}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Toggle me' }),
    });
    const created = await createRes.json() as { id: number; done: boolean };
    expect(created.done).toBe(false);

    const toggleRes = await fetch(`${url}/todos/${created.id}/toggle`, {
      method: 'POST',
    });
    expect(toggleRes.status).toBe(200);
    const toggled = await toggleRes.json() as { id: number; done: boolean };
    expect(toggled.done).toBe(true);
    expect(toggled.id).toBe(created.id);
  });

  it('POST /todos/:id/toggle returns 404 for non-existent id', async () => {
    const res = await fetch(`${url}/todos/99999/toggle`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown route', async () => {
    const res = await fetch(`${url}/unknown`);
    expect(res.status).toBe(404);
  });
});
