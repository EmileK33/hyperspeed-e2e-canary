/**
 * S0-A independent test — Shared scaffold / infrastructure
 */

// Declare Node.js globals without requiring @types/node.
declare const process: {
  env: Record<string, string | undefined>;
};

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// src/types/contracts.ts
// ---------------------------------------------------------------------------
import type { Todo, List, ApiOk, ApiError, AppRequest, AppResponse } from '../src/types/contracts.ts';

describe('src/types/contracts.ts', () => {
  it('Todo interface is usable as plain object', () => {
    const todo: Todo = { id: 1, title: 'Write tests', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Write tests');
    expect(todo.done).toBe(false);
  });

  it('List interface is usable as plain object', () => {
    const list: List = { id: 2, name: 'Work' };
    expect(list.id).toBe(2);
    expect(list.name).toBe('Work');
  });

  it('ApiOk wraps a data payload', () => {
    const ok: ApiOk<Todo> = { data: { id: 1, title: 'x', done: false } };
    expect(ok.data.title).toBe('x');
  });

  it('ApiError carries an error string', () => {
    const err: ApiError = { error: 'not found' };
    expect(err.error).toBe('not found');
  });
});

// ---------------------------------------------------------------------------
// src/lib/env.ts
// ---------------------------------------------------------------------------
import { requireEnv, optionalEnv } from '../src/lib/env.ts';

describe('src/lib/env.ts', () => {
  it('optionalEnv returns fallback when var is not set', () => {
    const result = optionalEnv('__CANARY_TEST_UNSET_VAR__', 'default-value');
    expect(result).toBe('default-value');
  });

  it('optionalEnv returns the env value when set', () => {
    process.env['__CANARY_TEST_SET_VAR__'] = 'hello';
    const result = optionalEnv('__CANARY_TEST_SET_VAR__', 'fallback');
    expect(result).toBe('hello');
    delete process.env['__CANARY_TEST_SET_VAR__'];
  });

  it('requireEnv throws when the variable is absent', () => {
    expect(() => requireEnv('__CANARY_TEST_ABSENT_VAR__')).toThrow(
      /"__CANARY_TEST_ABSENT_VAR__"/,
    );
  });

  it('requireEnv returns the value when set', () => {
    process.env['__CANARY_TEST_REQ_VAR__'] = 'present';
    expect(requireEnv('__CANARY_TEST_REQ_VAR__')).toBe('present');
    delete process.env['__CANARY_TEST_REQ_VAR__'];
  });
});

// ---------------------------------------------------------------------------
// src/http.ts
// ---------------------------------------------------------------------------
import { sendJson, matchPath, parseJsonBody } from '../src/http.ts';
import type { Route } from '../src/http.ts';

describe('src/http.ts — matchPath', () => {
  it('matches a static path exactly', () => {
    expect(matchPath('/health', '/health')).toEqual({});
  });

  it('returns null for a mismatched static path', () => {
    expect(matchPath('/health', '/status')).toBeNull();
  });

  it('captures a single named param', () => {
    expect(matchPath('/todos/:id', '/todos/42')).toEqual({ id: '42' });
  });

  it('captures multiple named params', () => {
    expect(matchPath('/lists/:listId/todos/:id', '/lists/7/todos/99')).toEqual({
      listId: '7',
      id: '99',
    });
  });

  it('returns null when segment count differs', () => {
    expect(matchPath('/todos/:id', '/todos/42/extra')).toBeNull();
  });

  it('returns null when a static segment does not match', () => {
    expect(matchPath('/todos/:id/toggle', '/todos/42/delete')).toBeNull();
  });

  it('decodes URI-encoded param values', () => {
    const result = matchPath('/items/:name', '/items/hello%20world');
    expect(result).toEqual({ name: 'hello world' });
  });
});

describe('src/http.ts — parseJsonBody', () => {
  it('parses a valid JSON string', () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for an empty string', () => {
    expect(parseJsonBody('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonBody('{bad json}')).toBeNull();
  });

  it('parses a JSON array', () => {
    expect(parseJsonBody('[1,2,3]')).toEqual([1, 2, 3]);
  });
});

describe('src/http.ts — sendJson', () => {
  it('writes status, Content-Type, and JSON body', () => {
    const headers: Record<string, string> = {};
    let body = '';
    let status = 0;

    const mockRes: AppResponse = {
      get statusCode() { return status; },
      set statusCode(v: number) { status = v; },
      setHeader(name: string, value: string) { headers[name] = value; },
      end(b?: string) { body = b ?? ''; },
    };

    sendJson(mockRes, 201, { id: 1, title: 'Test', done: false });

    expect(status).toBe(201);
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(body)).toEqual({ id: 1, title: 'Test', done: false });
  });
});

describe('src/http.ts — Route interface', () => {
  it('can construct a valid Route object', () => {
    const route: Route = {
      method: 'GET',
      path: '/health',
      handler: async (_req, res, _params) => {
        sendJson(res, 200, { status: 'ok' });
      },
    };
    expect(route.method).toBe('GET');
    expect(route.path).toBe('/health');
    expect(typeof route.handler).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// src/routes/index.ts
// ---------------------------------------------------------------------------
import { registerRoutes, getRoutes, clearRoutes } from '../src/routes/index.ts';

describe('src/routes/index.ts', () => {
  beforeEach(() => {
    clearRoutes();
  });

  it('starts with an empty route table after clearRoutes()', () => {
    expect(getRoutes()).toHaveLength(0);
  });

  it('registerRoutes adds routes to the table', () => {
    const route: Route = {
      method: 'GET',
      path: '/test',
      handler: async () => {},
    };
    registerRoutes([route]);
    expect(getRoutes()).toHaveLength(1);
    expect(getRoutes()[0].path).toBe('/test');
  });

  it('multiple registerRoutes calls accumulate routes', () => {
    registerRoutes([{ method: 'GET', path: '/a', handler: async () => {} }]);
    registerRoutes([{ method: 'POST', path: '/b', handler: async () => {} }]);
    expect(getRoutes()).toHaveLength(2);
  });

  it('getRoutes returns the live route reference', () => {
    const r1: Route = { method: 'GET', path: '/live', handler: async () => {} };
    registerRoutes([r1]);
    expect(getRoutes()[0]).toBe(r1);
  });
});

// ---------------------------------------------------------------------------
// src/middleware/auth.ts
// ---------------------------------------------------------------------------
import { extractBearerToken, validateToken, requireAuth } from '../src/middleware/auth.ts';

describe('src/middleware/auth.ts — extractBearerToken', () => {
  it('extracts a token from a well-formed Authorization header', () => {
    expect(extractBearerToken('Bearer mytoken123')).toBe('mytoken123');
  });

  it('is case-insensitive for the Bearer scheme', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('returns null for an absent header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for a non-Bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('handles an array header (takes first value)', () => {
    expect(extractBearerToken(['Bearer token1', 'Bearer token2'])).toBe('token1');
  });
});

describe('src/middleware/auth.ts — validateToken', () => {
  it('returns a Principal for a non-empty token', () => {
    const principal = validateToken('abc123');
    expect(principal).not.toBeNull();
    expect(principal?.token).toBe('abc123');
  });

  it('returns null for an empty token', () => {
    expect(validateToken('')).toBeNull();
  });
});

describe('src/middleware/auth.ts — requireAuth', () => {
  it('returns Principal when a valid token is provided', () => {
    const req: AppRequest = {
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer valid-token' },
    };
    const state = { status: 200, body: '' };
    const res: AppResponse = {
      get statusCode() { return state.status; },
      set statusCode(v: number) { state.status = v; },
      setHeader() {},
      end(b?: string) { state.body = b ?? ''; },
    };
    const principal = requireAuth(req, res);
    expect(principal).not.toBeNull();
    expect(principal?.token).toBe('valid-token');
  });

  it('returns null and sends 401 when Authorization header is missing', () => {
    const req: AppRequest = {
      method: 'GET',
      url: '/protected',
      headers: {},
    };
    const state = { status: 200, body: '' };
    const res: AppResponse = {
      get statusCode() { return state.status; },
      set statusCode(v: number) { state.status = v; },
      setHeader() {},
      end(b?: string) { state.body = b ?? ''; },
    };
    const principal = requireAuth(req, res);
    expect(principal).toBeNull();
    expect(state.status).toBe(401);
    expect(JSON.parse(state.body).error).toMatch(/unauthorized/i);
  });
});

// ---------------------------------------------------------------------------
// src/db/pool.ts
// ---------------------------------------------------------------------------
import { _setPool, query, closePool } from '../src/db/pool.ts';
import type { Pool, QueryResult } from '../src/db/pool.ts';

describe('src/db/pool.ts', () => {
  it('exports _setPool, query, closePool', () => {
    expect(typeof _setPool).toBe('function');
    expect(typeof query).toBe('function');
    expect(typeof closePool).toBe('function');
  });

  it('_setPool allows injecting a mock pool', async () => {
    const mockResult: QueryResult = { rows: [{ id: 1 }], rowCount: 1 };
    const mockPool: Pool = {
      // Cast through unknown to satisfy the generic constraint
      query: async () => mockResult as unknown as QueryResult<never>,
      end: async () => {},
    };

    _setPool(mockPool);
    const result = await query('SELECT 1');
    expect(result.rows).toEqual([{ id: 1 }]);

    _setPool(null);
  });

  it('closePool resolves without throwing when pool is null', async () => {
    _setPool(null);
    await expect(closePool()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// src/db/migrate.ts
// ---------------------------------------------------------------------------
import { runMigrations } from '../src/db/migrate.ts';

describe('src/db/migrate.ts', () => {
  it('runMigrations executes migration SQL statements', async () => {
    const executed: string[] = [];
    const mockPool: Pool = {
      query: async (text: string) => {
        executed.push(text);
        return { rows: [], rowCount: 0 } as unknown as QueryResult<never>;
      },
      end: async () => {},
    };

    _setPool(mockPool);
    await runMigrations();

    expect(executed.length).toBeGreaterThanOrEqual(2);
    expect(executed.some((s) => s.includes('todos'))).toBe(true);
    expect(executed.some((s) => s.includes('lists'))).toBe(true);

    _setPool(null);
  });
});
