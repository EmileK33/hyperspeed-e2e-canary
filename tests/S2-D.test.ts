/**
 * S2-D independent tests — src/routes/todos.ts
 *
 * Exercises GET /todos, POST /todos, and POST /todos/:id/toggle via a real
 * HTTP server using createServer() from src/server/app.ts, with a fake
 * in-memory pool so no live DB is required.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import { createServer } from '../src/server/app.ts';
import type { App } from '../src/server/app.ts';
import { setPool, resetPool } from '../src/db/pool.ts';
import type { DbPool } from '../src/db/pool.ts';
import routes, { todosRouter } from '../src/routes/todos.ts';
import type { Todo } from '../src/store/todos.ts';

// ---------------------------------------------------------------------------
// In-memory fake pool
// ---------------------------------------------------------------------------

let nextId = 1;
let rows: Todo[] = [];

function buildFakePool(): DbPool {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT INTO TODOS')) {
        const title = (params as [string])[0];
        const todo: Todo = {
          id: nextId++,
          title,
          done: false,
          created_at: new Date().toISOString(),
        };
        rows.push(todo);
        return { rows: [{ ...todo }], rowCount: 1 };
      }

      if (s.startsWith('SELECT') && s.includes('WHERE ID =')) {
        const id = (params as [number])[0];
        const found = rows.find((r) => r.id === id);
        return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
      }

      if (s.startsWith('SELECT') && !s.includes('WHERE')) {
        return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
      }

      if (s.startsWith('UPDATE TODOS')) {
        const id = (params as [number])[0];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx === -1) return { rows: [], rowCount: 0 };
        rows[idx] = { ...rows[idx], done: !rows[idx].done };
        return { rows: [{ ...rows[idx] }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }) as DbPool['query'],
    end: async () => {},
  };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface SimpleResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json: unknown;
}

function httpRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: unknown;
        try { json = JSON.parse(text); } catch { json = null; }
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: text,
          json,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let app: App;
let port: number;

beforeEach(() => {
  resetPool();
  nextId = 1;
  rows = [];
  setPool(buildFakePool());

  app = createServer();
  todosRouter(app.addRoutes);

  return new Promise<void>((resolve) => {
    app.server.listen(0, '127.0.0.1', () => {
      const addr = app.server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterEach(() => {
  resetPool();
  return new Promise<void>((resolve, reject) => {
    app.server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('todosRouter exports', () => {
  it('todosRouter is a function', () => {
    expect(typeof todosRouter).toBe('function');
  });

  it('default export is an array', () => {
    expect(Array.isArray(routes)).toBe(true);
  });

  it('default export contains GET /todos', () => {
    const r = routes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/todos',
    );
    expect(r).toBeDefined();
  });

  it('default export contains POST /todos', () => {
    const r = routes.find(
      (r) => r.method.toUpperCase() === 'POST' && r.path === '/todos',
    );
    expect(r).toBeDefined();
  });

  it('default export contains POST /todos/:id/toggle', () => {
    const r = routes.find(
      (r) => r.method.toUpperCase() === 'POST' && r.path === '/todos/:id/toggle',
    );
    expect(r).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /todos
// ---------------------------------------------------------------------------

describe('GET /todos', () => {
  it('returns 200 with an empty array initially', async () => {
    const res = await httpRequest(port, 'GET', '/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as unknown[]).length).toBe(0);
  });

  it('returns todos after creation', async () => {
    await httpRequest(port, 'POST', '/todos', { title: 'Alpha' });
    await httpRequest(port, 'POST', '/todos', { title: 'Beta' });
    const res = await httpRequest(port, 'GET', '/todos');
    expect(res.status).toBe(200);
    const list = res.json as Todo[];
    expect(list.length).toBe(2);
    expect(list.map((t) => t.title)).toContain('Alpha');
    expect(list.map((t) => t.title)).toContain('Beta');
  });

  it('responds with JSON content-type', async () => {
    const res = await httpRequest(port, 'GET', '/todos');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// POST /todos
// ---------------------------------------------------------------------------

describe('POST /todos', () => {
  it('returns 201 with the created todo', async () => {
    const res = await httpRequest(port, 'POST', '/todos', { title: 'Buy milk' });
    expect(res.status).toBe(201);
    const todo = res.json as Todo;
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
    expect(typeof todo.id).toBe('number');
  });

  it('returns 400 when title is missing', async () => {
    const res = await httpRequest(port, 'POST', '/todos', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 when title is an empty string', async () => {
    const res = await httpRequest(port, 'POST', '/todos', { title: '' });
    expect(res.status).toBe(400);
  });

  it('assigns incrementing ids', async () => {
    const r1 = await httpRequest(port, 'POST', '/todos', { title: 'First' });
    const r2 = await httpRequest(port, 'POST', '/todos', { title: 'Second' });
    const t1 = r1.json as Todo;
    const t2 = r2.json as Todo;
    expect(t2.id).toBeGreaterThan(t1.id);
  });
});

// ---------------------------------------------------------------------------
// POST /todos/:id/toggle
// ---------------------------------------------------------------------------

describe('POST /todos/:id/toggle', () => {
  it('flips done from false to true', async () => {
    const created = (
      await httpRequest(port, 'POST', '/todos', { title: 'Write tests' })
    ).json as Todo;

    const res = await httpRequest(port, 'POST', `/todos/${created.id}/toggle`);
    expect(res.status).toBe(200);
    expect((res.json as Todo).done).toBe(true);
  });

  it('flips done from true back to false', async () => {
    const created = (
      await httpRequest(port, 'POST', '/todos', { title: 'Double flip' })
    ).json as Todo;

    await httpRequest(port, 'POST', `/todos/${created.id}/toggle`);
    const res = await httpRequest(port, 'POST', `/todos/${created.id}/toggle`);
    expect(res.status).toBe(200);
    expect((res.json as Todo).done).toBe(false);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await httpRequest(port, 'POST', '/todos/9999/toggle');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Unsupported methods
// ---------------------------------------------------------------------------

describe('unsupported methods', () => {
  it('DELETE /todos returns 404', async () => {
    const res = await httpRequest(port, 'DELETE', '/todos');
    expect(res.status).toBe(404);
  });

  it('GET /todos/:id/toggle returns 404', async () => {
    const res = await httpRequest(port, 'GET', '/todos/1/toggle');
    expect(res.status).toBe(404);
  });
});
