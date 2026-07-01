import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEnv, getOptionalEnv, getDatabaseUrl, getPort } from '../src/lib/env.ts';
import type { Todo, List, ApiError, ApiOk, PaginationParams, AuthContext } from '../src/types/contracts.ts';
import { getPool, setPool, resetPool, createPool } from '../src/db/pool.ts';
import type { DbPool } from '../src/db/pool.ts';
import { runMigrations, MIGRATIONS } from '../src/db/migrate.ts';
import type { Migration } from '../src/db/migrate.ts';
import { extractBearerToken, attachAuth, requireAuth } from '../src/middleware/auth.ts';
import type { AuthedRequest } from '../src/middleware/auth.ts';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// src/lib/env.ts
// ---------------------------------------------------------------------------
describe('src/lib/env.ts', () => {
  it('exports expected functions', () => {
    expect(typeof getEnv).toBe('function');
    expect(typeof getOptionalEnv).toBe('function');
    expect(typeof getDatabaseUrl).toBe('function');
    expect(typeof getPort).toBe('function');
  });

  it('getEnv returns fallback when var is unset', () => {
    delete process.env['__TEST_MISSING__'];
    expect(getEnv('__TEST_MISSING__', 'fallback')).toBe('fallback');
  });

  it('getEnv throws when var is unset and no fallback provided', () => {
    delete process.env['__TEST_MISSING__'];
    expect(() => getEnv('__TEST_MISSING__')).toThrow(/Missing required/);
  });

  it('getEnv reads from process.env', () => {
    process.env['__TEST_PRESENT__'] = 'hello';
    expect(getEnv('__TEST_PRESENT__')).toBe('hello');
    delete process.env['__TEST_PRESENT__'];
  });

  it('getOptionalEnv returns undefined for missing vars', () => {
    delete process.env['__TEST_OPT__'];
    expect(getOptionalEnv('__TEST_OPT__')).toBeUndefined();
  });

  it('getDatabaseUrl has a default postgres URL', () => {
    const saved = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    expect(getDatabaseUrl()).toContain('postgres');
    if (saved !== undefined) process.env['DATABASE_URL'] = saved;
  });

  it('getPort returns default 3000', () => {
    const saved = process.env['PORT'];
    delete process.env['PORT'];
    expect(getPort()).toBe(3000);
    if (saved !== undefined) process.env['PORT'] = saved;
  });
});

// ---------------------------------------------------------------------------
// src/types/contracts.ts
// ---------------------------------------------------------------------------
describe('src/types/contracts.ts', () => {
  it('Todo type is structurally correct', () => {
    const todo: Todo = { id: 1, title: 'Write tests', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Write tests');
    expect(todo.done).toBe(false);
  });

  it('List type is structurally correct', () => {
    const list: List = { id: 1, name: 'Shopping' };
    expect(list.id).toBe(1);
    expect(list.name).toBe('Shopping');
  });

  it('ApiError type is structurally correct', () => {
    const err: ApiError = { error: 'Not found' };
    expect(err.error).toBe('Not found');
  });

  it('ApiOk wraps data correctly', () => {
    const ok: ApiOk<number> = { data: 42 };
    expect(ok.data).toBe(42);
  });

  it('PaginationParams has optional fields', () => {
    const p: PaginationParams = { limit: 10 };
    expect(p.limit).toBe(10);
    expect(p.offset).toBeUndefined();
  });

  it('AuthContext has optional fields', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    expect(ctx.userId).toBe('u1');
    expect(ctx.role).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// src/db/pool.ts
// ---------------------------------------------------------------------------
describe('src/db/pool.ts', () => {
  beforeEach(() => { resetPool(); });

  it('exports getPool, setPool, resetPool, createPool', () => {
    expect(typeof getPool).toBe('function');
    expect(typeof setPool).toBe('function');
    expect(typeof resetPool).toBe('function');
    expect(typeof createPool).toBe('function');
  });

  it('getPool throws before initialisation', () => {
    expect(() => getPool()).toThrow(/not initialised/i);
  });

  it('setPool / getPool round-trip', () => {
    const fake: DbPool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => {},
    };
    setPool(fake);
    expect(getPool()).toBe(fake);
  });

  it('resetPool clears the singleton', () => {
    const fake: DbPool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => {},
    };
    setPool(fake);
    resetPool();
    expect(() => getPool()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// src/db/migrate.ts
// ---------------------------------------------------------------------------
describe('src/db/migrate.ts', () => {
  beforeEach(() => { resetPool(); });

  it('exports runMigrations and MIGRATIONS', () => {
    expect(typeof runMigrations).toBe('function');
    expect(Array.isArray(MIGRATIONS)).toBe(true);
  });

  it('MIGRATIONS contains at least 2 steps', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(2);
  });

  it('each migration has name and up fields', () => {
    for (const m of MIGRATIONS) {
      expect(typeof m.name).toBe('string');
      expect(typeof m.up).toBe('string');
    }
  });

  it('runMigrations is idempotent with a fake pool', async () => {
    const applied = new Set<string>();
    const fake: DbPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT name FROM schema_migrations')) {
          const name = (params as string[])[0];
          return {
            rows: applied.has(name) ? [{ name }] : [],
            rowCount: applied.has(name) ? 1 : 0,
          };
        }
        if (sql.includes('INSERT INTO schema_migrations')) {
          applied.add((params as string[])[0]);
        }
        return { rows: [], rowCount: 0 };
      }) as DbPool['query'],
      end: async () => {},
    };
    setPool(fake);

    const migs: Migration[] = [
      { name: 'test_001', up: 'CREATE TABLE IF NOT EXISTS t1 (id SERIAL);' },
      { name: 'test_002', up: 'CREATE TABLE IF NOT EXISTS t2 (id SERIAL);' },
    ];

    await runMigrations(migs);
    expect(applied.has('test_001')).toBe(true);
    expect(applied.has('test_002')).toBe(true);

    // Second run must not re-apply
    await runMigrations(migs);
    expect(applied.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// src/middleware/auth.ts
// ---------------------------------------------------------------------------
function makeReq(authHeader?: string): AuthedRequest {
  const req = new EventEmitter() as AuthedRequest;
  req.headers = authHeader ? { authorization: authHeader } : {};
  return req;
}

function makeFakeRes() {
  const state = { statusCode: 200, body: '' };
  const res = {
    writeHead: (code: number) => { state.statusCode = code; },
    end: (data?: string) => { state.body = data ?? ''; },
  } as unknown as ServerResponse;
  return { res, state };
}

describe('src/middleware/auth.ts', () => {
  it('exports extractBearerToken, attachAuth, requireAuth', () => {
    expect(typeof extractBearerToken).toBe('function');
    expect(typeof attachAuth).toBe('function');
    expect(typeof requireAuth).toBe('function');
  });

  it('extractBearerToken returns null for missing header', () => {
    expect(extractBearerToken(makeReq())).toBeNull();
  });

  it('extractBearerToken returns null for non-Bearer scheme', () => {
    expect(extractBearerToken(makeReq('Basic abc123'))).toBeNull();
  });

  it('extractBearerToken returns token from valid header', () => {
    expect(extractBearerToken(makeReq('Bearer mytoken'))).toBe('mytoken');
  });

  it('attachAuth sets auth.userId from token', () => {
    const req = makeReq('Bearer tok123');
    attachAuth(req);
    expect(req.auth?.userId).toBe('tok123');
  });

  it('attachAuth sets empty auth when no token present', () => {
    const req = makeReq();
    attachAuth(req);
    expect(req.auth).toBeDefined();
    expect(req.auth?.userId).toBeUndefined();
  });

  it('requireAuth returns false and writes 401 when no token', () => {
    const req = makeReq();
    const { res, state } = makeFakeRes();
    const result = requireAuth(req, res);
    expect(result).toBe(false);
    expect(state.statusCode).toBe(401);
    expect(JSON.parse(state.body).error).toBeTruthy();
  });

  it('requireAuth returns true when Bearer token is present', () => {
    const req = makeReq('Bearer valid-token');
    const { res } = makeFakeRes();
    const result = requireAuth(req, res);
    expect(result).toBe(true);
  });
});
