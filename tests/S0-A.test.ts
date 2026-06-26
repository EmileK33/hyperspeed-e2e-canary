/**
 * S0-A independent test -- verifies all owned exports are present and functional.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';

// Types & CRUD (contracts)
import {
  type Todo,
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
  _resetStore,
} from '../src/types/contracts.ts';

// Routers
import {
  healthRouter,
  listsRouter,
  statusRouter,
  todosRouter,
} from '../src/routes/index.ts';

// Server
import { createServer } from '../src/server.ts';

// Helpers

function getJson(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request, Agent }) => {
      const parsed = new URL(url);
      const req = request(
        {
          hostname: parsed.hostname,
          port: Number(parsed.port),
          path: parsed.pathname,
          method: 'GET',
          agent: new Agent({ keepAlive: false }),
        },
        (res) => {
          let data = '';
          res.on('data', (c: Buffer) => { data += c.toString(); });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
        },
      );
      req.on('error', reject);
      req.end();
    }).catch(reject);
  });
}

function postJson(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request, Agent }) => {
      const parsed = new URL(url);
      const payload = JSON.stringify(body);
      const req = request(
        {
          hostname: parsed.hostname,
          port: Number(parsed.port),
          path: parsed.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          agent: new Agent({ keepAlive: false }),
        },
        (res) => {
          let data = '';
          res.on('data', (c: Buffer) => { data += c.toString(); });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    }).catch(reject);
  });
}

function patchJson(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request, Agent }) => {
      const parsed = new URL(url);
      const req = request(
        {
          hostname: parsed.hostname,
          port: Number(parsed.port),
          path: parsed.pathname,
          method: 'PATCH',
          agent: new Agent({ keepAlive: false }),
        },
        (res) => {
          let data = '';
          res.on('data', (c: Buffer) => { data += c.toString(); });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
        },
      );
      req.on('error', reject);
      req.end();
    }).catch(reject);
  });
}

// Contract / type tests

describe('Todo CRUD (contracts)', () => {
  beforeEach(() => _resetStore());

  it('createTodo returns a Todo with the given title', () => {
    const todo: Todo = createTodo('Buy milk');
    expect(todo.id).toBeDefined();
    expect(todo.title).toBe('Buy milk');
    expect(todo.completed).toBe(false);
    expect(todo.createdAt).toBeDefined();
    expect(todo.updatedAt).toBeDefined();
  });

  it('getTodo retrieves a created todo', () => {
    const created = createTodo('Walk dog');
    const fetched = getTodo(created.id);
    expect(fetched).toEqual(created);
  });

  it('getTodo returns undefined for unknown id', () => {
    expect(getTodo('999')).toBeUndefined();
  });

  it('listTodos returns all todos', () => {
    createTodo('A');
    createTodo('B');
    createTodo('C');
    expect(listTodos()).toHaveLength(3);
  });

  it('toggleTodo flips completed flag', () => {
    const todo = createTodo('Read book');
    const toggled = toggleTodo(todo.id);
    expect(toggled?.completed).toBe(true);
    const toggledBack = toggleTodo(todo.id);
    expect(toggledBack?.completed).toBe(false);
  });

  it('toggleTodo returns undefined for unknown id', () => {
    expect(toggleTodo('999')).toBeUndefined();
  });
});

// Router factory tests

describe('Router factories', () => {
  it('healthRouter() returns an object with prefix and handle', () => {
    const router = healthRouter();
    expect(router).toHaveProperty('prefix');
    expect(router).toHaveProperty('handle');
    expect(typeof router.handle).toBe('function');
  });

  it('statusRouter() returns an object with prefix and handle', () => {
    const router = statusRouter();
    expect(router).toHaveProperty('prefix');
    expect(router).toHaveProperty('handle');
  });

  it('todosRouter() returns an object with prefix and handle', () => {
    const router = todosRouter();
    expect(router).toHaveProperty('prefix');
    expect(router).toHaveProperty('handle');
  });

  it('listsRouter() returns an object with prefix and handle', () => {
    const router = listsRouter();
    expect(router).toHaveProperty('prefix');
    expect(router).toHaveProperty('handle');
  });
});

// HTTP server integration

describe('createServer + HTTP endpoints', () => {
  let server: Server;
  const PORT = 19321;
  const BASE = 'http://127.0.0.1:' + PORT;

  beforeEach(async () => {
    _resetStore();
    server = createServer({ port: PORT });
    await new Promise<void>((resolve) => server.once('listening', resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 { status: "ok" }', async () => {
    const { status, body } = await getJson(BASE + '/health');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ok');
  });

  it('GET /status returns 200 with brand color #3a86ff', async () => {
    const { status, body } = await getJson(BASE + '/status');
    expect(status).toBe(200);
    expect((body as { brand: string }).brand).toBe('#3a86ff');
  });

  it('GET /todos returns empty array initially', async () => {
    const { status, body } = await getJson(BASE + '/todos');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('POST /todos creates a todo', async () => {
    const { status, body } = await postJson(BASE + '/todos', { title: 'Test todo' });
    expect(status).toBe(201);
    expect((body as Todo).title).toBe('Test todo');
    expect((body as Todo).completed).toBe(false);
  });

  it('GET /todos/:id retrieves created todo', async () => {
    const created = createTodo('Existing todo');
    const { status, body } = await getJson(BASE + '/todos/' + created.id);
    expect(status).toBe(200);
    expect((body as Todo).id).toBe(created.id);
  });

  it('PATCH /todos/:id/toggle toggles completed', async () => {
    const created = createTodo('Toggle me');
    const { status, body } = await patchJson(BASE + '/todos/' + created.id + '/toggle');
    expect(status).toBe(200);
    expect((body as Todo).completed).toBe(true);
  });

  it('GET /lists returns 200', async () => {
    const { status } = await getJson(BASE + '/lists');
    expect(status).toBe(200);
  });

  it('GET /unknown returns 404', async () => {
    const { status } = await getJson(BASE + '/unknown');
    expect(status).toBe(404);
  });
});
