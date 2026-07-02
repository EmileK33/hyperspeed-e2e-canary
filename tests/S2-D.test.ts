/**
 * Independent tests for S2-D: todos routes -- src/routes/todos.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { compileRoute, matchPath, readJsonBody, sendJson, type RouteRequest } from '../src/http.js';
import { setPool, closePool } from '../src/db/pool.js';
import type { DbPool, QueryResult } from '../src/db/pool.js';
import type { Todo } from '../src/store/todos.js';
import routes, { todosRouter } from '../src/routes/todos.js';

// ── Fake in-memory pool ───────────────────────────────────────────────────────

function makeFakePool(): DbPool {
  let nextId = 1;
  const rows: Todo[] = [];

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT INTO TODOS')) {
        const title = params?.[0] as string;
        const row: Todo = { id: nextId++, title, done: false };
        rows.push(row);
        return { rows: [row] as unknown as T[], rowCount: 1 };
      }

      if (s.startsWith('SELECT') && s.includes('WHERE ID')) {
        const id = params?.[0] as number;
        const found = rows.find((r) => r.id === id);
        return { rows: (found ? [found] : []) as unknown as T[], rowCount: found ? 1 : 0 };
      }

      if (s.startsWith('SELECT')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as T[], rowCount: sorted.length };
      }

      if (s.startsWith('UPDATE TODOS')) {
        const id = params?.[0] as number;
        const row = rows.find((r) => r.id === id);
        if (!row) return { rows: [] as unknown as T[], rowCount: 0 };
        row.done = !row.done;
        return { rows: [row] as unknown as T[], rowCount: 1 };
      }

      return { rows: [] as unknown as T[], rowCount: 0 };
    },
    async end() {},
  };
}

// ── Server helpers ────────────────────────────────────────────────────────────

async function startServer(
  routeList: typeof routes,
): Promise<{ port: number; close: () => Promise<void> }> {
  const compiled = routeList.map((r) => ({ r, c: compileRoute(r.path) }));

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const body =
        method === 'GET' || method === 'HEAD' ? undefined : await readJsonBody(req);
      for (const { r, c } of compiled) {
        if (r.method.toUpperCase() !== method) continue;
        const params = matchPath(c, pathname);
        if (!params) continue;
        const rq = req as RouteRequest;
        rq.params = params;
        rq.body = body;
        await r.handler(rq, res);
        return;
      }
      sendJson(res, 404, { error: 'Route not found' });
    } catch {
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal Server Error' });
      else res.end();
    }
  });

  await new Promise<void>((ok) => server.listen(0, () => ok()));
  const port = (server.address() as { port: number }).port;

  return {
    port,
    close: () =>
      new Promise<void>((ok, fail) => server.close((e?: Error) => (e ? fail(e) : ok()))),
  };
}

function get(port: number, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((ok, fail) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method: 'GET' },
      (r) => {
        let raw = '';
        r.on('data', (c: Buffer) => { raw += c.toString(); });
        r.on('end', () => ok({ status: r.statusCode ?? 0, body: JSON.parse(raw) }));
      },
    );
    req.on('error', fail);
    req.end();
  });
}

function post(
  port: number,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((ok, fail) => {
    const payload = body !== undefined ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (r) => {
        let raw = '';
        r.on('data', (c: Buffer) => { raw += c.toString(); });
        r.on('end', () => ok({ status: r.statusCode ?? 0, body: JSON.parse(raw) }));
      },
    );
    req.on('error', fail);
    req.end(payload);
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setPool(makeFakePool());
});

afterEach(async () => {
  await closePool();
});

// ── Export shape tests ────────────────────────────────────────────────────────

describe('src/routes/todos -- exports', () => {
  it('default-exports an array of Route objects', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('exports todosRouter as a function', () => {
    expect(typeof todosRouter).toBe('function');
  });

  it('todosRouter() returns the routes array', () => {
    const result = todosRouter();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(routes.length);
  });

  it('registers GET /todos', () => {
    const route = routes.find((r) => r.method.toUpperCase() === 'GET' && r.path === '/todos');
    expect(route).toBeDefined();
  });

  it('registers POST /todos', () => {
    const route = routes.find((r) => r.method.toUpperCase() === 'POST' && r.path === '/todos');
    expect(route).toBeDefined();
  });

  it('registers POST /todos/:id/toggle', () => {
    const route = routes.find(
      (r) => r.method.toUpperCase() === 'POST' && r.path === '/todos/:id/toggle',
    );
    expect(route).toBeDefined();
  });
});

// ── GET /todos ────────────────────────────────────────────────────────────────

describe('GET /todos', () => {
  it('returns 200 with an empty array when no todos exist', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await get(port, '/todos');
      expect(result.status).toBe(200);
      expect(result.body).toEqual([]);
    } finally {
      await close();
    }
  });

  it('returns all created todos', async () => {
    const { port, close } = await startServer(routes);
    try {
      await post(port, '/todos', { title: 'Alpha' });
      await post(port, '/todos', { title: 'Beta' });
      const result = await get(port, '/todos');
      expect(result.status).toBe(200);
      const body = result.body as Todo[];
      expect(body).toHaveLength(2);
      expect(body[0]?.title).toBe('Alpha');
      expect(body[1]?.title).toBe('Beta');
    } finally {
      await close();
    }
  });

  it('todos are shaped correctly', async () => {
    const { port, close } = await startServer(routes);
    try {
      await post(port, '/todos', { title: 'Shape check' });
      const result = await get(port, '/todos');
      const body = result.body as Todo[];
      expect(body[0]).toMatchObject({ id: expect.any(Number), title: 'Shape check', done: false });
    } finally {
      await close();
    }
  });
});

// ── POST /todos ───────────────────────────────────────────────────────────────

describe('POST /todos', () => {
  it('creates a todo and returns 201', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos', { title: 'Buy milk' });
      expect(result.status).toBe(201);
      const body = result.body as Todo;
      expect(body.title).toBe('Buy milk');
      expect(body.done).toBe(false);
      expect(typeof body.id).toBe('number');
    } finally {
      await close();
    }
  });

  it('returns 400 when title is missing', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos', {});
      expect(result.status).toBe(400);
    } finally {
      await close();
    }
  });

  it('returns 400 when title is whitespace only', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos', { title: '   ' });
      expect(result.status).toBe(400);
    } finally {
      await close();
    }
  });

  it('trims the title', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos', { title: '  Trimmed  ' });
      expect(result.status).toBe(201);
      expect((result.body as Todo).title).toBe('Trimmed');
    } finally {
      await close();
    }
  });
});

// ── POST /todos/:id/toggle ────────────────────────────────────────────────────

describe('POST /todos/:id/toggle', () => {
  it('toggles a todo from false to true and returns 200', async () => {
    const { port, close } = await startServer(routes);
    try {
      const created = (await post(port, '/todos', { title: 'Toggle me' })).body as Todo;
      const result = await post(port, '/todos/' + created.id + '/toggle');
      expect(result.status).toBe(200);
      const body = result.body as Todo;
      expect(body.done).toBe(true);
      expect(body.id).toBe(created.id);
    } finally {
      await close();
    }
  });

  it('toggles back to false on second toggle', async () => {
    const { port, close } = await startServer(routes);
    try {
      const created = (await post(port, '/todos', { title: 'Toggle twice' })).body as Todo;
      await post(port, '/todos/' + created.id + '/toggle');
      const result = await post(port, '/todos/' + created.id + '/toggle');
      expect((result.body as Todo).done).toBe(false);
    } finally {
      await close();
    }
  });

  it('returns 404 for non-existent id', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos/9999/toggle');
      expect(result.status).toBe(404);
    } finally {
      await close();
    }
  });

  it('returns 400 for invalid id', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await post(port, '/todos/abc/toggle');
      expect(result.status).toBe(400);
    } finally {
      await close();
    }
  });
});
