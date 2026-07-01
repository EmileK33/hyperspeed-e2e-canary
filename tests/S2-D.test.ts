/**
 * S2-D independent test — todo routes
 * Exercises GET /todos, POST /todos, and POST /todos/:id/toggle via real HTTP.
 *
 * Uses a custom pattern-matching dispatcher wrapping the real route handlers
 * because src/app.ts dispatch uses exact-path matching; parameterised routes
 * are matched here via matchesPattern from src/http.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse as NodeServerResponse } from 'node:http';
import { todosRouter } from '../src/routes/todos.ts';
import { clearRoutes } from '../src/routes/index.ts';
import { setPool, resetPool } from '../src/db/pool.ts';
import { matchesPattern } from '../src/http.ts';
import type { Route } from '../src/types/contracts.ts';

// ---------------------------------------------------------------------------
// In-memory mock DB
// ---------------------------------------------------------------------------

interface MockRow {
  id: number;
  title: string;
  done: boolean;
  created_at: string;
}

function buildMockDb(initial: MockRow[] = []) {
  const rows: MockRow[] = [...initial];
  let nextId = (initial.reduce((m, r) => Math.max(m, r.id), 0)) + 1;

  return {
    rows,
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT INTO TODOS')) {
        const title = params?.[0] as string;
        const row: MockRow = { id: nextId++, title, done: false, created_at: new Date().toISOString() };
        rows.push(row);
        return { rows: [row] as unknown as T[] };
      }

      if (s.startsWith('SELECT') && s.includes('WHERE ID =')) {
        const id = params?.[0] as number;
        const found = rows.find(r => r.id === id);
        return { rows: (found ? [found] : []) as unknown as T[] };
      }

      if (s.startsWith('SELECT') && !s.includes('WHERE')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as T[] };
      }

      if (s.startsWith('UPDATE TODOS SET DONE')) {
        const id = params?.[0] as number;
        const row = rows.find(r => r.id === id);
        if (!row) return { rows: [] };
        row.done = !row.done;
        return { rows: [row] as unknown as T[] };
      }

      return { rows: [] };
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal HTTP test harness with pattern-matching dispatch
// ---------------------------------------------------------------------------

interface TestServer {
  url: string;
  close(): Promise<void>;
}

async function startTestServer(routes: Route[]): Promise<TestServer> {
  const server = httpCreateServer(async (nodeReq: IncomingMessage, nodeRes: NodeServerResponse) => {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      nodeReq.on('data', (chunk: Buffer) => chunks.push(chunk));
      nodeReq.on('end', resolve);
      nodeReq.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks).toString();
    let body: unknown;
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch { body = rawBody; }
    }

    const method = nodeReq.method ?? 'GET';
    const url = nodeReq.url ?? '/';
    const path = url.split('?')[0];

    const route = routes.find(
      r => r.method.toUpperCase() === method.toUpperCase() && matchesPattern(path, r.path),
    );

    const req = {
      method,
      url,
      headers: nodeReq.headers as Record<string, string | string[] | undefined>,
      body,
    };

    const res = {
      statusCode: 200,
      setHeader(name: string, value: string) { nodeRes.setHeader(name, value); },
      end(data?: string) { nodeRes.statusCode = this.statusCode; nodeRes.end(data ?? ''); },
    };

    if (!route) {
      nodeRes.statusCode = 404;
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    await route.handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Bad server address');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    url: baseUrl,
    close: () => new Promise((resolve, reject) => server.close(e => (e ? reject(e) : resolve()))),
  };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function jsonFetch(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let ts: TestServer;

beforeEach(async () => {
  clearRoutes();
  resetPool();
  setPool(buildMockDb());
  ts = await startTestServer(todosRouter());
});

afterEach(async () => {
  await ts?.close();
  resetPool();
});

// ---------------------------------------------------------------------------
// todosRouter() export shape
// ---------------------------------------------------------------------------

describe('todosRouter() export', () => {
  it('is a function', () => {
    expect(typeof todosRouter).toBe('function');
  });

  it('returns an array', () => {
    expect(Array.isArray(todosRouter())).toBe(true);
  });

  it('includes GET /todos', () => {
    expect(todosRouter().some(r => r.method === 'GET' && r.path === '/todos')).toBe(true);
  });

  it('includes POST /todos', () => {
    expect(todosRouter().some(r => r.method === 'POST' && r.path === '/todos')).toBe(true);
  });

  it('includes POST /todos/:id/toggle', () => {
    expect(
      todosRouter().some(r => r.method === 'POST' && r.path === '/todos/:id/toggle'),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /todos
// ---------------------------------------------------------------------------

describe('GET /todos', () => {
  it('returns 200', async () => {
    const { status } = await jsonFetch(`${ts.url}/todos`);
    expect(status).toBe(200);
  });

  it('returns an array when no todos exist', async () => {
    const { body } = await jsonFetch(`${ts.url}/todos`);
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns empty array initially', async () => {
    const { body } = await jsonFetch(`${ts.url}/todos`);
    expect(body).toHaveLength(0);
  });

  it('returns created todos', async () => {
    await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Buy milk' }),
    });
    const { body } = await jsonFetch(`${ts.url}/todos`);
    expect((body as unknown[]).length).toBe(1);
  });

  it('returned items have id, title and done fields', async () => {
    await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Shape check' }),
    });
    const { body } = await jsonFetch(`${ts.url}/todos`);
    const [todo] = body as Array<{ id: number; title: string; done: boolean }>;
    expect(todo).toHaveProperty('id');
    expect(todo).toHaveProperty('title', 'Shape check');
    expect(todo).toHaveProperty('done', false);
  });
});

// ---------------------------------------------------------------------------
// POST /todos
// ---------------------------------------------------------------------------

describe('POST /todos', () => {
  it('returns 201', async () => {
    const { status } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Write tests' }),
    });
    expect(status).toBe(201);
  });

  it('returns the created todo', async () => {
    const { body } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Ship it' }),
    });
    const todo = body as { id: number; title: string; done: boolean };
    expect(todo.title).toBe('Ship it');
    expect(typeof todo.id).toBe('number');
    expect(todo.done).toBe(false);
  });

  it('assigns incrementing ids', async () => {
    const r1 = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'First' }),
    });
    const r2 = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Second' }),
    });
    expect((r2.body as { id: number }).id).toBeGreaterThan((r1.body as { id: number }).id);
  });

  it('returns 400 when title is missing', async () => {
    const { status } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });

  it('returns 400 when title is empty string', async () => {
    const { status } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    });
    expect(status).toBe(400);
  });

  it('persists the todo so GET /todos returns it', async () => {
    await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Persistent' }),
    });
    const { body } = await jsonFetch(`${ts.url}/todos`);
    expect((body as Array<{ title: string }>).map(t => t.title)).toContain('Persistent');
  });
});

// ---------------------------------------------------------------------------
// POST /todos/:id/toggle
// ---------------------------------------------------------------------------

describe('POST /todos/:id/toggle', () => {
  it('returns 200 for a known todo', async () => {
    const { body: created } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Toggle me' }),
    });
    const { id } = created as { id: number };
    const { status } = await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    expect(status).toBe(200);
  });

  it('flips done from false to true', async () => {
    const { body: created } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Initially false' }),
    });
    const { id } = created as { id: number };
    const { body: toggled } = await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    expect((toggled as { done: boolean }).done).toBe(true);
  });

  it('flips done from true back to false', async () => {
    const { body: created } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Toggle twice' }),
    });
    const { id } = created as { id: number };
    await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    const { body: toggled2 } = await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    expect((toggled2 as { done: boolean }).done).toBe(false);
  });

  it('returns 404 for an unknown todo id', async () => {
    const { status } = await jsonFetch(`${ts.url}/todos/99999/toggle`, { method: 'POST' });
    expect(status).toBe(404);
  });

  it('returns the updated todo with correct id and title', async () => {
    const { body: created } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Check shape' }),
    });
    const { id } = created as { id: number };
    const { body: toggled } = await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    const todo = toggled as { id: number; title: string; done: boolean };
    expect(todo.id).toBe(id);
    expect(todo.title).toBe('Check shape');
  });

  it('GET /todos reflects the toggled state', async () => {
    const { body: created } = await jsonFetch(`${ts.url}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Reflect toggle' }),
    });
    const { id } = created as { id: number };
    await jsonFetch(`${ts.url}/todos/${id}/toggle`, { method: 'POST' });
    const { body: list } = await jsonFetch(`${ts.url}/todos`);
    const found = (list as Array<{ id: number; done: boolean }>).find(t => t.id === id);
    expect(found?.done).toBe(true);
  });
});
