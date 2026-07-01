/**
 * S0-A independent test - Shared scaffold / infrastructure
 * Exercises all 8 owned files in isolation (no network, no DB).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { getPool, setPool, resetPool } from '../src/db/pool.ts';
import { getEnv, getDatabaseUrl, getPort } from '../src/lib/env.ts';
import { noopAuth, createAuthMiddleware, compose } from '../src/middleware/auth.ts';
import { registerRoutes, getRoutes, clearRoutes } from '../src/routes/index.ts';
import { startServer } from '../src/server.ts';
import type {
  Todo,
  TodoList,
  Route,
  DbClient,
  IncomingRequest,
  ServerResponse,
} from '../src/types/contracts.ts';

function makeRes(): ServerResponse & { _body: string } {
  return {
    statusCode: 200,
    _body: '',
    setHeader(_n: string, _v: string) {},
    end(data?: string) { (this as any)._body = data ?? ''; },
  };
}

function makeReq(method = 'GET', url = '/'): IncomingRequest {
  return { method, url, headers: {} };
}

const mockDb: DbClient = {
  query: async <T = unknown>() => ({ rows: [] as T[] }),
};

describe('src/types/contracts.ts - type shapes', () => {
  it('Todo type has required fields', () => {
    const todo: Todo = { id: 1, title: 'Buy milk', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
  });

  it('Todo accepts optional created_at', () => {
    const todo: Todo = { id: 2, title: 'Walk dog', done: true, created_at: '2026-01-01' };
    expect(todo.created_at).toBe('2026-01-01');
  });

  it('TodoList type has required fields', () => {
    const list: TodoList = { id: 1, name: 'Groceries' };
    expect(list.id).toBe(1);
    expect(list.name).toBe('Groceries');
  });

  it('Route type works with a handler', () => {
    const route: Route = { method: 'GET', path: '/health', handler: () => {} };
    expect(route.method).toBe('GET');
    expect(typeof route.handler).toBe('function');
  });

  it('DbClient type matches the mock', () => {
    const client: DbClient = mockDb;
    expect(typeof client.query).toBe('function');
  });
});

describe('src/lib/env.ts', () => {
  it('getEnv returns fallback when variable is absent', () => {
    expect(getEnv('__S0A_MISSING__', 'hello')).toBe('hello');
  });

  it('getEnv throws when variable absent and no fallback', () => {
    expect(() => getEnv('__S0A_DEFINITELY_MISSING__')).toThrow(
      /Missing required environment variable/
    );
  });

  it('getEnv returns the value when present', () => {
    (globalThis as any).process.env['__S0A_TEST_VAR__'] = 'canary';
    expect(getEnv('__S0A_TEST_VAR__')).toBe('canary');
    delete (globalThis as any).process.env['__S0A_TEST_VAR__'];
  });

  it('getDatabaseUrl returns a string', () => {
    expect(typeof getDatabaseUrl()).toBe('string');
  });

  it('getPort returns a positive number', () => {
    expect(getPort()).toBeGreaterThan(0);
  });
});

describe('src/db/pool.ts', () => {
  beforeEach(() => resetPool());

  it('getPool returns a DbClient', () => {
    expect(typeof getPool().query).toBe('function');
  });

  it('stub throws when query is called', async () => {
    await expect(getPool().query('SELECT 1')).rejects.toThrow(/Database not configured/);
  });

  it('setPool replaces the client', async () => {
    const calls: string[] = [];
    setPool({ query: async (sql) => { calls.push(sql as string); return { rows: [] }; } });
    await getPool().query('SELECT 2');
    expect(calls).toContain('SELECT 2');
  });

  it('resetPool restores stub', async () => {
    setPool(mockDb);
    resetPool();
    await expect(getPool().query('X')).rejects.toThrow(/Database not configured/);
  });
});

describe('src/db/migrate.ts', () => {
  it('calls db.query at least once', async () => {
    const calls: string[] = [];
    await runMigrations({ query: async (sql) => { calls.push(sql as string); return { rows: [] }; } });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('SQL references todos table', async () => {
    const calls: string[] = [];
    await runMigrations({ query: async (sql) => { calls.push(sql as string); return { rows: [] }; } });
    expect(calls.join('\n')).toMatch(/todos/i);
  });

  it('SQL references lists table', async () => {
    const calls: string[] = [];
    await runMigrations({ query: async (sql) => { calls.push(sql as string); return { rows: [] }; } });
    expect(calls.join('\n')).toMatch(/lists/i);
  });
});

describe('src/middleware/auth.ts', () => {
  it('noopAuth calls next', async () => {
    let called = false;
    await noopAuth(makeReq(), makeRes(), () => { called = true; });
    expect(called).toBe(true);
  });

  it('createAuthMiddleware is a pass-through by default', async () => {
    let called = false;
    await createAuthMiddleware()(makeReq(), makeRes(), () => { called = true; });
    expect(called).toBe(true);
  });

  it('createAuthMiddleware accepts secret option', () => {
    expect(() => createAuthMiddleware({ secret: 'abc' })).not.toThrow();
  });

  it('compose runs middlewares in order', async () => {
    const order: number[] = [];
    const mw = compose(
      async (_r, _s, next) => { order.push(1); await next(); },
      async (_r, _s, next) => { order.push(2); await next(); }
    );
    await mw(makeReq(), makeRes(), () => { order.push(3); });
    expect(order).toEqual([1, 2, 3]);
  });

  it('compose with no middlewares calls next directly', async () => {
    let called = false;
    await compose()(makeReq(), makeRes(), () => { called = true; });
    expect(called).toBe(true);
  });
});

describe('src/routes/index.ts', () => {
  beforeEach(() => clearRoutes());

  it('starts empty', () => {
    expect(getRoutes()).toEqual([]);
  });

  it('registerRoutes adds routes', () => {
    const r: Route = { method: 'GET', path: '/ping', handler: () => {} };
    registerRoutes([r]);
    expect(getRoutes()).toContain(r);
  });

  it('registerRoutes can be called multiple times', () => {
    const r1: Route = { method: 'GET', path: '/a', handler: () => {} };
    const r2: Route = { method: 'POST', path: '/b', handler: () => {} };
    registerRoutes([r1]);
    registerRoutes([r2]);
    expect(getRoutes()).toContain(r1);
    expect(getRoutes()).toContain(r2);
  });

  it('clearRoutes empties the registry', () => {
    registerRoutes([{ method: 'GET', path: '/x', handler: () => {} }]);
    clearRoutes();
    expect(getRoutes()).toEqual([]);
  });

  it('getRoutes returns a snapshot', () => {
    const r: Route = { method: 'GET', path: '/snap', handler: () => {} };
    registerRoutes([r]);
    const snap = getRoutes();
    clearRoutes();
    expect(snap).toContain(r);
    expect(getRoutes()).toEqual([]);
  });
});

describe('src/app.ts', () => {
  beforeEach(() => clearRoutes());

  it('createApp returns an App with getRoutes', () => {
    expect(Array.isArray(createApp().getRoutes())).toBe(true);
  });

  it('dispatch finds route from config', () => {
    const r: Route = { method: 'GET', path: '/hi', handler: () => {} };
    expect(createApp({ routes: [r] }).dispatch('GET', '/hi')).toBe(r);
  });

  it('dispatch is case-insensitive for method', () => {
    const r: Route = { method: 'post', path: '/x', handler: () => {} };
    expect(createApp({ routes: [r] }).dispatch('POST', '/x')).toBe(r);
  });

  it('dispatch returns undefined for unknown route', () => {
    expect(createApp().dispatch('GET', '/nope')).toBeUndefined();
  });

  it('handle returns 404 for unmatched route', async () => {
    const res = makeRes();
    await createApp().handle(makeReq('GET', '/unknown'), res);
    expect(res.statusCode).toBe(404);
    expect(res._body).toMatch(/Route not found/);
  });

  it('handle invokes the matched handler', async () => {
    let called = false;
    const r: Route = {
      method: 'GET',
      path: '/ok',
      handler: (_req, res) => { called = true; res.statusCode = 200; res.end('ok'); },
    };
    const res = makeRes();
    await createApp({ routes: [r] }).handle(makeReq('GET', '/ok'), res);
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('handle strips query string before matching', async () => {
    const r: Route = { method: 'GET', path: '/items', handler: (_req, res) => { res.end('[]'); } };
    const res = makeRes();
    await createApp({ routes: [r] }).handle(makeReq('GET', '/items?sort=asc'), res);
    expect(res.statusCode).toBe(200);
  });

  it('addRoutes works at runtime', () => {
    const app = createApp();
    const r: Route = { method: 'DELETE', path: '/gone', handler: () => {} };
    app.addRoutes([r]);
    expect(app.dispatch('DELETE', '/gone')).toBe(r);
  });

  it('picks up routes from global registry', () => {
    const r: Route = { method: 'GET', path: '/global', handler: () => {} };
    registerRoutes([r]);
    expect(createApp().dispatch('GET', '/global')).toBe(r);
    clearRoutes();
  });
});

describe('src/server.ts', () => {
  it('startServer returns a handle with port and stop', () => {
    const h = startServer(0);
    expect(typeof h.port).toBe('number');
    expect(typeof h.stop).toBe('function');
    h.stop();
  });

  it('uses the provided port number', () => {
    const h = startServer(7979);
    expect(h.port).toBe(7979);
    h.stop();
  });
});
