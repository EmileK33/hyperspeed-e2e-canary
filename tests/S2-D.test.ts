// Independent test for Session S2-D — todos route (US-003).
// Run: npm run test -- tests/S2-D.test.ts
//
// NOTE: On Windows with spaces in path, pathToFileURL can fail silently during
// route auto-discovery. We mock loadRoutes to import the todos module directly,
// then test through the REAL createServer dispatcher.

import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';

// Mock loadRoutes BEFORE any imports that pull in src/routes/index.js
vi.mock('../src/routes/index.js', () => ({
  loadRoutes: async () => {
    const mod = await import('../src/routes/todos.js');
    return Array.isArray(mod.default) ? mod.default : [];
  },
}));

// Mock the store so tests don't need a real DB
vi.mock('../src/store/todos.js', () => {
  const todos: Array<{ id: number; title: string; done: boolean; list_id: null; created_at: string }> = [];
  let nextId = 1;
  return {
    listTodos: async () => [...todos],
    createTodo: async (title: string, list_id: null) => {
      const todo = { id: nextId++, title, done: false, list_id: list_id ?? null, created_at: new Date().toISOString() };
      todos.push(todo);
      return todo;
    },
    toggleTodo: async (id: number) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return undefined;
      todo.done = !todo.done;
      return { ...todo };
    },
  };
});

// Helper to make HTTP requests
function request(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: payload
        ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
        : {},
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Todos routes — US-003', () => {
  const servers: http.Server[] = [];
  let baseUrl: string;

  async function startServer() {
    const { createServer } = await import('../src/app.js');
    const server = await createServer();
    servers.push(server);
    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://localhost:${port}`;
    return server;
  }

  afterEach(async () => {
    for (const s of servers) {
      if (s.listening) {
        await new Promise<void>((res) => s.close(() => res()));
      }
    }
    servers.length = 0;
  });

  it('exports todosRouter as a function', async () => {
    const mod = await import('../src/routes/todos.js');
    expect(typeof mod.todosRouter).toBe('function');
  });

  it('todosRouter() returns a non-empty array of routes', async () => {
    const { todosRouter } = await import('../src/routes/todos.js');
    const routes = todosRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('default export includes GET /todos, POST /todos, POST /todos/:id/toggle', async () => {
    const mod = await import('../src/routes/todos.js');
    const routes = mod.default as Array<{ method: string; path: string }>;
    expect(routes.some((r) => r.method.toUpperCase() === 'GET' && r.path === '/todos')).toBe(true);
    expect(routes.some((r) => r.method.toUpperCase() === 'POST' && r.path === '/todos')).toBe(true);
    expect(routes.some((r) => r.method.toUpperCase() === 'POST' && r.path === '/todos/:id/toggle')).toBe(true);
  });

  it('GET /todos returns 200 with an array', async () => {
    await startServer();
    const { status, body } = await request('GET', `${baseUrl}/todos`);
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(Array.isArray(json)).toBe(true);
  });

  it('POST /todos creates a todo and returns 201', async () => {
    await startServer();
    const { status, body } = await request('POST', `${baseUrl}/todos`, { title: 'Buy milk' });
    expect(status).toBe(201);
    const json = JSON.parse(body);
    expect(json.title).toBe('Buy milk');
    expect(json.done).toBe(false);
    expect(typeof json.id).toBe('number');
  });

  it('POST /todos without title returns 400', async () => {
    await startServer();
    const { status } = await request('POST', `${baseUrl}/todos`, {});
    expect(status).toBe(400);
  });

  it('POST /todos/:id/toggle flips done and returns 200', async () => {
    await startServer();
    // Create a todo first
    const createRes = await request('POST', `${baseUrl}/todos`, { title: 'Toggle me' });
    const created = JSON.parse(createRes.body);
    expect(created.done).toBe(false);

    // Toggle it
    const toggleRes = await request('POST', `${baseUrl}/todos/${created.id}/toggle`);
    expect(toggleRes.status).toBe(200);
    const toggled = JSON.parse(toggleRes.body);
    expect(toggled.done).toBe(true);
    expect(toggled.id).toBe(created.id);
  });

  it('POST /todos/:id/toggle with unknown id returns 404', async () => {
    await startServer();
    const { status } = await request('POST', `${baseUrl}/todos/99999/toggle`);
    expect(status).toBe(404);
  });

  it('GET /todos reflects created items', async () => {
    await startServer();
    await request('POST', `${baseUrl}/todos`, { title: 'Listed todo' });
    const { status, body } = await request('GET', `${baseUrl}/todos`);
    expect(status).toBe(200);
    const todos = JSON.parse(body);
    expect(todos.some((t: { title: string }) => t.title === 'Listed todo')).toBe(true);
  });
});
