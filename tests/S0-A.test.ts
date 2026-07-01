/**
 * S0-A independent test -- Shared scaffold / infrastructure
 *
 * Exercises each owned module in isolation without requiring a live
 * database or network connection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── src/lib/env.ts ───────────────────────────────────────────────

import { parseEnv, requireEnv, env } from '../src/lib/env.ts';

describe('src/lib/env.ts', () => {
  it('parseEnv returns defaults when vars are absent', () => {
    const result = parseEnv({});
    expect(result.DATABASE_URL).toBe('');
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('parseEnv reads provided values', () => {
    const result = parseEnv({
      DATABASE_URL: 'postgres://localhost/test',
      PORT: '5432',
      NODE_ENV: 'production',
    });
    expect(result.DATABASE_URL).toBe('postgres://localhost/test');
    expect(result.PORT).toBe(5432);
    expect(result.NODE_ENV).toBe('production');
  });

  it('requireEnv throws when variable is missing', () => {
    expect(() => requireEnv('MISSING_VAR', {})).toThrow(
      'Missing required environment variable: MISSING_VAR',
    );
  });

  it('requireEnv returns value when present', () => {
    const value = requireEnv('MY_VAR', { MY_VAR: 'hello' });
    expect(value).toBe('hello');
  });

  it('env singleton has expected keys', () => {
    expect(env).toHaveProperty('DATABASE_URL');
    expect(env).toHaveProperty('PORT');
    expect(env).toHaveProperty('NODE_ENV');
  });
});

// ── src/types/contracts.ts ──────────────────────────────────────

import type {
  Todo,
  List,
  ApiError,
  HealthResponse,
  StatusResponse,
} from '../src/types/contracts.ts';

describe('src/types/contracts.ts', () => {
  it('Todo shape is assignable', () => {
    const todo: Todo = { id: 1, title: 'Write tests', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Write tests');
    expect(todo.done).toBe(false);
  });

  it('List shape is assignable', () => {
    const list: List = { id: 2, name: 'Shopping' };
    expect(list.id).toBe(2);
    expect(list.name).toBe('Shopping');
  });

  it('ApiError shape is assignable', () => {
    const err: ApiError = { error: 'Not found' };
    expect(err.error).toBe('Not found');
  });

  it('HealthResponse shape is assignable', () => {
    const h: HealthResponse = { status: 'ok' };
    expect(h.status).toBe('ok');
  });

  it('StatusResponse includes brandColor field', () => {
    const s: StatusResponse = {
      version: '1.0.0',
      uptimeSeconds: 42,
      brandColor: '#3a86ff',
    };
    expect(s.brandColor).toBe('#3a86ff');
  });
});

// ── src/middleware/auth.ts ──────────────────────────────────────

import { authMiddleware, composeMiddleware } from '../src/middleware/auth.ts';

describe('src/middleware/auth.ts', () => {
  function makeMocks() {
    return {
      req: {} as IncomingMessage,
      res: {} as ServerResponse,
    };
  }

  it('authMiddleware calls next()', async () => {
    const { req, res } = makeMocks();
    const next = vi.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('composeMiddleware runs all middleware in order', async () => {
    const { req, res } = makeMocks();
    const order: number[] = [];
    const mw1 = vi.fn(
      async (_r: IncomingMessage, _s: ServerResponse, next: () => void) => {
        order.push(1);
        await next();
      },
    );
    const mw2 = vi.fn(
      async (_r: IncomingMessage, _s: ServerResponse, next: () => void) => {
        order.push(2);
        await next();
      },
    );
    const composed = composeMiddleware(mw1, mw2);
    const finalNext = vi.fn();
    await composed(req, res, finalNext);
    expect(order).toEqual([1, 2]);
    expect(finalNext).toHaveBeenCalledOnce();
  });

  it('composeMiddleware stops if middleware omits next()', async () => {
    const { req, res } = makeMocks();
    const blocking = vi.fn(
      async (_r: IncomingMessage, _s: ServerResponse, _n: () => void) => {
        // intentionally does NOT call next
      },
    );
    const after = vi.fn(
      async (_r: IncomingMessage, _s: ServerResponse, next: () => void) => {
        await next();
      },
    );
    const composed = composeMiddleware(blocking, after);
    await composed(req, res, vi.fn());
    expect(blocking).toHaveBeenCalledOnce();
    expect(after).not.toHaveBeenCalled();
  });
});

// ── src/db/pool.ts ──────────────────────────────────────────────

import {
  configurePool,
  getPool,
  closePool,
  _resetPool,
} from '../src/db/pool.ts';
import type { Pool } from '../src/db/pool.ts';

describe('src/db/pool.ts', () => {
  beforeEach(() => _resetPool());

  it('getPool throws if configurePool was never called', () => {
    expect(() => getPool()).toThrow('Database pool is not configured');
  });

  it('configurePool + getPool returns the stub', () => {
    const stub: Pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    configurePool(() => stub);
    expect(getPool()).toBe(stub);
  });

  it('getPool returns singleton on repeated calls', () => {
    let calls = 0;
    const stub: Pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    configurePool(() => {
      calls++;
      return stub;
    });
    getPool();
    getPool();
    expect(calls).toBe(1);
  });

  it('closePool calls end() and clears instance', async () => {
    const endFn = vi.fn().mockResolvedValue(undefined);
    const stub: Pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: endFn,
    };
    configurePool(() => stub);
    getPool();
    await closePool();
    expect(endFn).toHaveBeenCalledOnce();
  });
});

// ── src/db/migrate.ts ───────────────────────────────────────────

import { migrate, BASE_MIGRATIONS } from '../src/db/migrate.ts';

describe('src/db/migrate.ts', () => {
  it('BASE_MIGRATIONS is non-empty', () => {
    expect(Array.isArray(BASE_MIGRATIONS)).toBe(true);
    expect(BASE_MIGRATIONS.length).toBeGreaterThan(0);
  });

  it('each migration has name + sql strings', () => {
    for (const m of BASE_MIGRATIONS) {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.sql).toBe('string');
      expect(m.sql.length).toBeGreaterThan(0);
    }
  });

  it('migrate skips already-applied migrations', async () => {
    const queryFn = vi.fn();
    queryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // CREATE TABLE
    queryFn.mockResolvedValueOnce({
      rows: BASE_MIGRATIONS.map((m) => ({ name: m.name })),
      rowCount: BASE_MIGRATIONS.length,
    }); // SELECT -- all already applied
    const stub: Pool = { query: queryFn, end: vi.fn() };
    await migrate(stub);
    // Only 2 queries: CREATE TABLE + SELECT (no INSERTs needed)
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('migrate applies all pending migrations', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const stub: Pool = { query: queryFn, end: vi.fn() };
    await migrate(stub);
    // 2 (setup) + BASE_MIGRATIONS.length * 2 (sql + insert each)
    expect(queryFn).toHaveBeenCalledTimes(2 + BASE_MIGRATIONS.length * 2);
  });
});

// ── src/routes/index.ts ─────────────────────────────────────────

import { matchRoute, RouteRegistry, registry } from '../src/routes/index.ts';

describe('matchRoute()', () => {
  const handler = vi.fn();
  const routes = [
    { method: 'GET', path: '/todos', handler },
    { method: 'POST', path: '/todos', handler },
    { method: 'GET', path: '/todos/:id', handler },
    { method: 'POST', path: '/todos/:id/toggle', handler },
  ];

  it('matches exact path', () => {
    const r = matchRoute('GET', '/todos', routes);
    expect(r).not.toBeNull();
    expect(r!.params).toEqual({});
  });

  it('extracts named params', () => {
    const r = matchRoute('GET', '/todos/42', routes);
    expect(r).not.toBeNull();
    expect(r!.params).toEqual({ id: '42' });
  });

  it('extracts params from multi-segment path', () => {
    const r = matchRoute('POST', '/todos/7/toggle', routes);
    expect(r).not.toBeNull();
    expect(r!.params).toEqual({ id: '7' });
  });

  it('returns null for unknown path', () => {
    expect(matchRoute('GET', '/unknown', routes)).toBeNull();
  });

  it('returns null for wrong method', () => {
    expect(matchRoute('DELETE', '/todos', routes)).toBeNull();
  });

  it('strips query strings before matching', () => {
    expect(matchRoute('GET', '/todos?page=2', routes)).not.toBeNull();
  });
});

describe('RouteRegistry', () => {
  it('starts empty', () => {
    const r = new RouteRegistry();
    expect(r.routes).toHaveLength(0);
  });

  it('register() is fluent and adds routes', () => {
    const r = new RouteRegistry();
    const handler = vi.fn();
    const ret = r.register({ method: 'GET', path: '/health', handler });
    expect(ret).toBe(r);
    expect(r.routes).toHaveLength(1);
  });

  it('match() delegates correctly', () => {
    const r = new RouteRegistry();
    r.register({ method: 'GET', path: '/health', handler: vi.fn() });
    expect(r.match('GET', '/health')).not.toBeNull();
    expect(r.match('POST', '/health')).toBeNull();
  });
});

describe('global registry', () => {
  it('registry is a RouteRegistry instance', () => {
    expect(registry).toBeInstanceOf(RouteRegistry);
  });
});

// ── src/app.ts ──────────────────────────────────────────────────

import { createServer, json } from '../src/app.ts';

describe('src/app.ts', () => {
  it('createServer() returns an http.Server', () => {
    const server = createServer();
    expect(server).toBeInstanceOf(http.Server);
    server.close();
  });

  it('json() writes correct status, headers, and body', () => {
    const written: {
      status?: number;
      headers?: Record<string, string | number>;
      body?: string;
    } = {};
    const res = {
      writeHead: (s: number, h: Record<string, string | number>) => {
        written.status = s;
        written.headers = h;
      },
      end: (b: string) => {
        written.body = b;
      },
    } as unknown as ServerResponse;

    json(res, 200, { status: 'ok' });

    expect(written.status).toBe(200);
    expect(written.body).toBe(JSON.stringify({ status: 'ok' }));
    expect((written.headers ?? {})['Content-Type']).toBe('application/json');
  });

  it('responds 404 JSON for unknown routes', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const port = (server.address() as { port: number }).port;

    const body = await new Promise<string>((resolve, reject) => {
      http
        .get('http://localhost:' + port + '/nonexistent', (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString()));
          res.on('error', reject);
        })
        .on('error', reject);
    });

    server.close();
    const parsed = JSON.parse(body) as { error: string };
    expect(parsed.error).toBe('Route not found');
  });
});
