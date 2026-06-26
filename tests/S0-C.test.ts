/**
 * S0-C independent test - Shared scaffold / infrastructure
 */
import { describe, it, expect, beforeEach } from 'vitest';
import http from 'node:http';
import {
  createTodo, getTodo, listTodos, toggleTodo, _resetStore,
  type Todo,
} from '../src/store/todos.ts';
import { createServer } from '../src/server/app.ts';
import { healthRouter } from '../src/routes/health.ts';
import { listsRouter } from '../src/routes/lists.ts';
import { statusRouter } from '../src/routes/status.ts';
import { todosRouter } from '../src/routes/todos.ts';

describe('Todo store', () => {
  beforeEach(() => _resetStore());

  it('exports Todo type via createTodo return shape', async () => {
    const todo: Todo = await createTodo('hello');
    expect(todo).toMatchObject({ title: 'hello', done: false });
    expect(typeof todo.id).toBe('string');
  });

  it('createTodo returns a new todo with done=false', async () => {
    const todo = await createTodo('buy milk');
    expect(todo.title).toBe('buy milk');
    expect(todo.done).toBe(false);
    expect(todo.id).toBeTruthy();
  });

  it('getTodo retrieves by id', async () => {
    const created = await createTodo('task');
    const found = await getTodo(created.id);
    expect(found).toEqual(created);
  });

  it('getTodo returns undefined for unknown id', async () => {
    expect(await getTodo('x')).toBeUndefined();
  });

  it('listTodos returns all todos', async () => {
    await createTodo('a'); await createTodo('b');
    expect(await listTodos()).toHaveLength(2);
  });

  it('toggleTodo flips done flag', async () => {
    const t = await createTodo('flip');
    expect((await toggleTodo(t.id))?.done).toBe(true);
    expect((await toggleTodo(t.id))?.done).toBe(false);
  });

  it('toggleTodo returns undefined for unknown id', async () => {
    expect(await toggleTodo('ghost')).toBeUndefined();
  });
});

async function req(
  server: http.Server, method: string, path: string, payload?: unknown
): Promise<{ status: number; body: unknown }> {
  const port = (server.address() as { port: number }).port;
  return new Promise((resolve, reject) => {
    const raw = payload !== undefined ? JSON.stringify(payload) : undefined;
    const r = http.request(
      { hostname: '127.0.0.1', port, path, method,
        headers: raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {} },
      (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      }
    );
    r.on('error', reject);
    if (raw) r.write(raw);
    r.end();
  });
}

function listen(server: http.Server): Promise<() => Promise<void>> {
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () =>
      resolve(() => new Promise(res => server.close(() => res())))
    )
  );
}

describe('createServer', () => {
  it('is a function', () => { expect(typeof createServer).toBe('function'); });

  it('returns an http.Server', () => {
    expect(createServer()).toBeInstanceOf(http.Server);
  });

  it('returns 404 for unknown routes', async () => {
    const s = createServer([]); const stop = await listen(s);
    try {
      const { status, body } = await req(s, 'GET', '/no-such-route');
      expect(status).toBe(404);
      expect(body).toMatchObject({ error: expect.any(String) });
    } finally { await stop(); }
  });
});

describe('healthRouter', () => {
  it('is a function', () => { expect(typeof healthRouter).toBe('function'); });

  it('GET /health => 200 {status:ok}', async () => {
    const s = createServer([healthRouter()]); const stop = await listen(s);
    try {
      const { status, body } = await req(s, 'GET', '/health');
      expect(status).toBe(200);
      expect(body).toMatchObject({ status: 'ok' });
    } finally { await stop(); }
  });
});

describe('statusRouter', () => {
  it('is a function', () => { expect(typeof statusRouter).toBe('function'); });

  it('GET /status => 200 with version + uptimeSeconds + brandColor', async () => {
    const s = createServer([statusRouter()]); const stop = await listen(s);
    try {
      const { status, body } = await req(s, 'GET', '/status');
      expect(status).toBe(200);
      expect(body).toMatchObject({ version: expect.any(String), uptimeSeconds: expect.any(Number), brandColor: '#3a86ff' });
    } finally { await stop(); }
  });
});

describe('todosRouter', () => {
  beforeEach(() => _resetStore());

  it('is a function', () => { expect(typeof todosRouter).toBe('function'); });

  it('POST /todos => 201', async () => {
    const s = createServer([todosRouter()]); const stop = await listen(s);
    try {
      const { status, body } = await req(s, 'POST', '/todos', { title: 'test' });
      expect(status).toBe(201);
      expect(body).toMatchObject({ title: 'test', done: false });
    } finally { await stop(); }
  });

  it('GET /todos returns array', async () => {
    const s = createServer([todosRouter()]); const stop = await listen(s);
    try {
      await req(s, 'POST', '/todos', { title: 'one' });
      await req(s, 'POST', '/todos', { title: 'two' });
      const { status, body } = await req(s, 'GET', '/todos');
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect((body as unknown[]).length).toBe(2);
    } finally { await stop(); }
  });

  it('POST /todos/:id/toggle flips done', async () => {
    const s = createServer([todosRouter()]); const stop = await listen(s);
    try {
      const { body: created } = await req(s, 'POST', '/todos', { title: 'flip' });
      const id = (created as Todo).id;
      const { status, body: toggled } = await req(s, 'POST', '/todos/' + id + '/toggle');
      expect(status).toBe(200);
      expect((toggled as Todo).done).toBe(true);
    } finally { await stop(); }
  });
});

describe('listsRouter', () => {
  it('is a function', () => { expect(typeof listsRouter).toBe('function'); });

  it('POST /lists => 201', async () => {
    const s = createServer([listsRouter()]); const stop = await listen(s);
    try {
      const { status, body } = await req(s, 'POST', '/lists', { name: 'shopping' });
      expect(status).toBe(201);
      expect(body).toMatchObject({ name: 'shopping' });
    } finally { await stop(); }
  });

  it('GET /lists returns array', async () => {
    const s = createServer([listsRouter()]); const stop = await listen(s);
    try {
      await req(s, 'POST', '/lists', { name: 'L' });
      const { status, body } = await req(s, 'GET', '/lists');
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    } finally { await stop(); }
  });
});
