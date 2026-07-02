// tests/S2-D.test.ts — Session S2-D
//
// Independent test for the /todos endpoints (US-003).

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';

vi.mock('../src/store/todos.js', () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  toggleTodo: vi.fn(),
}));

import { listTodos, createTodo, toggleTodo } from '../src/store/todos.js';
import todosRoutes, { todosRouter } from '../src/routes/todos.js';
import {
  compileRoute,
  matchPath,
  readJsonBody,
  sendJson,
  type RouteRequest,
} from '../src/http.js';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const routes = todosRouter();
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));

  server = http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const body =
        method === 'GET' || method === 'HEAD'
          ? undefined
          : await readJsonBody(req);
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

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

function get(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: null });
        }
      });
    }).on('error', reject);
  });
}

function post(path: string, data?: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = data !== undefined ? JSON.stringify(data) : '';
    const port = parseInt(baseUrl.split(':')[2], 10);
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: null });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('todos route module shape', () => {
  it('default export is a non-empty Route array', () => {
    expect(Array.isArray(todosRoutes)).toBe(true);
    expect(todosRoutes.length).toBeGreaterThan(0);
  });

  it('exports GET /todos route', () => {
    const route = todosRoutes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/todos'
    );
    expect(route).toBeDefined();
  });

  it('exports POST /todos route', () => {
    const route = todosRoutes.find(
      (r) => r.method.toUpperCase() === 'POST' && r.path === '/todos'
    );
    expect(route).toBeDefined();
  });

  it('exports POST /todos/:id/toggle route', () => {
    const route = todosRoutes.find(
      (r) => r.method.toUpperCase() === 'POST' && r.path === '/todos/:id/toggle'
    );
    expect(route).toBeDefined();
  });

  it('todosRouter is a function', () => {
    expect(typeof todosRouter).toBe('function');
  });

  it('todosRouter() returns the routes', () => {
    const r = todosRouter();
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(todosRoutes.length);
  });
});

describe('GET /todos', () => {
  it('returns 200 with array of todos', async () => {
    const mockTodos = [
      { id: 1, title: 'Buy milk', done: false },
      { id: 2, title: 'Walk dog', done: true },
    ];
    vi.mocked(listTodos).mockResolvedValueOnce(mockTodos);
    const { status, body } = await get('/todos');
    expect(status).toBe(200);
    expect(body).toEqual(mockTodos);
  });

  it('returns 200 with empty array when no todos', async () => {
    vi.mocked(listTodos).mockResolvedValueOnce([]);
    const { status, body } = await get('/todos');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe('POST /todos', () => {
  it('returns 201 with created todo', async () => {
    const created = { id: 1, title: 'Buy milk', done: false };
    vi.mocked(createTodo).mockResolvedValueOnce(created);
    const { status, body } = await post('/todos', { title: 'Buy milk' });
    expect(status).toBe(201);
    expect(body).toEqual(created);
    expect(createTodo).toHaveBeenCalledWith('Buy milk');
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await post('/todos', {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBeTruthy();
  });

  it('returns 400 when body is empty', async () => {
    const { status } = await post('/todos');
    expect(status).toBe(400);
  });
});

describe('POST /todos/:id/toggle', () => {
  it('returns 200 with toggled todo', async () => {
    const toggled = { id: 1, title: 'Buy milk', done: true };
    vi.mocked(toggleTodo).mockResolvedValueOnce(toggled);
    const { status, body } = await post('/todos/1/toggle');
    expect(status).toBe(200);
    expect(body).toEqual(toggled);
    expect(toggleTodo).toHaveBeenCalledWith(1);
  });

  it('returns 404 when todo not found', async () => {
    vi.mocked(toggleTodo).mockResolvedValueOnce(null);
    const { status, body } = await post('/todos/999/toggle');
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBeTruthy();
  });

  it('returns 404 for unknown path', async () => {
    const { status } = await get('/unknown-path');
    expect(status).toBe(404);
  });
});
