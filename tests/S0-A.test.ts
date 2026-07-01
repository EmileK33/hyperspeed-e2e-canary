import { describe, it, expect, afterEach } from 'vitest';
import { requireEnv, getEnv, loadEnv } from '../src/lib/env.ts';
import type { Todo, List, Route, RouteContext, RouteResponse, RouteHandler, AuthPayload, CreateTodoBody, CreateListBody, ApiError } from '../src/types/contracts.ts';
import { getPool, closePool, setPool } from '../src/db/pool.ts';
import type { Pool, QueryResult } from '../src/db/pool.ts';
import { migrate, dropSchema } from '../src/db/migrate.ts';
import { extractBearerToken, isValidToken, requireAuth } from '../src/middleware/auth.ts';

// env tests
describe('src/lib/env.ts', () => {
  it('requireEnv returns value when set', () => {
    process.env['TEST_VAR_X'] = 'hello';
    expect(requireEnv('TEST_VAR_X')).toBe('hello');
    delete process.env['TEST_VAR_X'];
  });
  it('requireEnv throws when variable is missing', () => {
    delete process.env['MISSING_VAR_99'];
    expect(() => requireEnv('MISSING_VAR_99')).toThrow('MISSING_VAR_99');
  });
  it('requireEnv throws when variable is empty string', () => {
    process.env['EMPTY_VAR'] = '';
    expect(() => requireEnv('EMPTY_VAR')).toThrow('EMPTY_VAR');
    delete process.env['EMPTY_VAR'];
  });
  it('getEnv returns value when set', () => {
    process.env['G_VAR'] = 'world';
    expect(getEnv('G_VAR', 'fallback')).toBe('world');
    delete process.env['G_VAR'];
  });
  it('getEnv returns fallback when missing', () => {
    delete process.env['MISSING_G_VAR'];
    expect(getEnv('MISSING_G_VAR', 'fb')).toBe('fb');
  });
  it('getEnv returns fallback for empty string', () => {
    process.env['EMPTY_G'] = '';
    expect(getEnv('EMPTY_G', 'default')).toBe('default');
    delete process.env['EMPTY_G'];
  });
  it('loadEnv parses valid env', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['PORT'] = '4000';
    process.env['NODE_ENV'] = 'test';
    const env = loadEnv();
    expect(env.DATABASE_URL).toBe('postgres://localhost/test');
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('test');
  });
  it('loadEnv uses PORT default of 3000', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    delete process.env['PORT'];
    process.env['NODE_ENV'] = 'test';
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
  });
  it('loadEnv throws on invalid PORT', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['PORT'] = 'not-a-number';
    process.env['NODE_ENV'] = 'test';
    expect(() => loadEnv()).toThrow();
  });
  it('loadEnv throws when DATABASE_URL is missing', () => {
    delete process.env['DATABASE_URL'];
    process.env['NODE_ENV'] = 'test';
    expect(() => loadEnv()).toThrow('DATABASE_URL');
  });
});

// contracts tests
describe('src/types/contracts.ts', () => {
  it('Todo type has expected shape', () => {
    const todo: Todo = { id: 1, title: 'Buy milk', done: false, list_id: null, created_at: '2026-01-01T00:00:00Z' };
    expect(todo.id).toBe(1);
    expect(todo.done).toBe(false);
    expect(todo.list_id).toBeNull();
  });
  it('List type has expected shape', () => {
    const list: List = { id: 2, name: 'Groceries', created_at: '2026-01-01T00:00:00Z' };
    expect(list.name).toBe('Groceries');
  });
  it('Route type can be constructed', () => {
    const handler: RouteHandler = async (_ctx: RouteContext): Promise<RouteResponse> => ({ status: 200, body: { ok: true } });
    const route: Route = { method: 'GET', path: '/ping', handler };
    expect(route.method).toBe('GET');
    expect(typeof route.handler).toBe('function');
  });
  it('ApiError has error field', () => {
    const err: ApiError = { error: 'Not found', code: 'NOT_FOUND' };
    expect(err.error).toBe('Not found');
  });
  it('CreateTodoBody and CreateListBody shapes', () => {
    const ctb: CreateTodoBody = { title: 'test', list_id: 1 };
    const clb: CreateListBody = { name: 'My list' };
    expect(ctb.title).toBe('test');
    expect(clb.name).toBe('My list');
  });
  it('AuthPayload has sub', () => {
    const p: AuthPayload = { sub: 'u1', iat: 1000, exp: 2000 };
    expect(p.sub).toBe('u1');
  });
});

// pool tests
describe('src/db/pool.ts', () => {
  afterEach(async () => { await closePool(); });

  it('setPool / getPool round-trip without real pg', async () => {
    const mockPool: Pool = {
      async query<T = Record<string, unknown>>(): Promise<QueryResult<T>> { return { rows: [], rowCount: 0 }; },
      async connect() { return { query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [], rowCount: 0 }), release: () => {} }; },
      async end() {},
    };
    setPool(mockPool);
    const pool = await getPool();
    expect(pool).toBe(mockPool);
  });

  it('closePool resets singleton', async () => {
    const mockPool: Pool = {
      async query<T = Record<string, unknown>>(): Promise<QueryResult<T>> { return { rows: [], rowCount: 0 }; },
      async connect() { return { query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [], rowCount: 0 }), release: () => {} }; },
      async end() {},
    };
    setPool(mockPool);
    await closePool();
    delete process.env['DATABASE_URL'];
    await expect(getPool()).rejects.toThrow('DATABASE_URL');
  });

  it('getPool throws when DATABASE_URL missing', async () => {
    delete process.env['DATABASE_URL'];
    await expect(getPool()).rejects.toThrow('DATABASE_URL');
  });

  it('QueryResult type structure', () => {
    const result: QueryResult<{ id: number }> = { rows: [{ id: 1 }], rowCount: 1 };
    expect(result.rows[0]?.id).toBe(1);
    expect(result.rowCount).toBe(1);
  });
});

// migrate tests
describe('src/db/migrate.ts', () => {
  afterEach(async () => { await closePool(); });

  it('migrate() executes CREATE TABLE IF NOT EXISTS for todos and lists', async () => {
    const queries: string[] = [];
    const mockPool: Pool = {
      async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> { queries.push(sql); return { rows: [], rowCount: 0 }; },
      async connect() { return { query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [], rowCount: 0 }), release: () => {} }; },
      async end() {},
    };
    setPool(mockPool);
    await migrate();
    expect(queries.length).toBeGreaterThan(0);
    const sql = queries[0] ?? '';
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('todos');
    expect(sql).toContain('lists');
  });

  it('dropSchema() executes DROP TABLE IF EXISTS', async () => {
    const queries: string[] = [];
    const mockPool: Pool = {
      async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> { queries.push(sql); return { rows: [], rowCount: 0 }; },
      async connect() { return { query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [], rowCount: 0 }), release: () => {} }; },
      async end() {},
    };
    setPool(mockPool);
    await dropSchema();
    expect(queries.length).toBeGreaterThan(0);
    const sql = queries[0] ?? '';
    expect(sql).toContain('DROP TABLE IF EXISTS');
  });
});

// auth middleware tests
describe('src/middleware/auth.ts', () => {
  const ORIG = process.env['AUTH_SECRET'];
  afterEach(() => {
    if (ORIG === undefined) { delete process.env['AUTH_SECRET']; }
    else { process.env['AUTH_SECRET'] = ORIG; }
  });

  describe('extractBearerToken', () => {
    it('returns null for undefined', () => { expect(extractBearerToken(undefined)).toBeNull(); });
    it('returns null for non-bearer', () => { expect(extractBearerToken('Basic abc')).toBeNull(); });
    it('extracts from Bearer header', () => { expect(extractBearerToken('Bearer mytoken')).toBe('mytoken'); });
    it('is case-insensitive', () => { expect(extractBearerToken('BEARER tok')).toBe('tok'); });
    it('returns null for empty string', () => { expect(extractBearerToken('')).toBeNull(); });
  });

  describe('isValidToken', () => {
    it('open-dev mode: returns true without AUTH_SECRET', () => {
      delete process.env['AUTH_SECRET'];
      expect(isValidToken(null)).toBe(true);
      expect(isValidToken('any')).toBe(true);
    });
    it('returns false when secret set and token null', () => {
      process.env['AUTH_SECRET'] = 'sec';
      expect(isValidToken(null)).toBe(false);
    });
    it('returns true when token matches secret', () => {
      process.env['AUTH_SECRET'] = 'sec';
      expect(isValidToken('sec')).toBe(true);
    });
    it('returns false when token does not match', () => {
      process.env['AUTH_SECRET'] = 'sec';
      expect(isValidToken('wrong')).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('returns null in open-dev mode', () => {
      delete process.env['AUTH_SECRET'];
      expect(requireAuth({ params: {}, query: {}, body: null, headers: {} })).toBeNull();
    });
    it('returns 401 when secret set and no header', () => {
      process.env['AUTH_SECRET'] = 'secret';
      const r = requireAuth({ params: {}, query: {}, body: null, headers: {} });
      expect(r?.status).toBe(401);
    });
    it('returns 401 when wrong token', () => {
      process.env['AUTH_SECRET'] = 'secret';
      const r = requireAuth({ params: {}, query: {}, body: null, headers: { authorization: 'Bearer wrong' } });
      expect(r?.status).toBe(401);
    });
    it('returns null when correct token', () => {
      process.env['AUTH_SECRET'] = 'secret';
      const r = requireAuth({ params: {}, query: {}, body: null, headers: { authorization: 'Bearer secret' } });
      expect(r).toBeNull();
    });
    it('response body has error field', () => {
      process.env['AUTH_SECRET'] = 'secret';
      const r = requireAuth({ params: {}, query: {}, body: null, headers: {} });
      expect((r?.body as { error: string }).error).toBeTruthy();
    });
  });
});
