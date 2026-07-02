// Independent tests for S0-A: Shared scaffold / infrastructure.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ServerResponse } from 'node:http';
import http from 'node:http';

// ── src/types/contracts ───────────────────────────────────────────────────
import type {
  Todo,
  TodoList,
  ErrorBody,
  CreateTodoBody,
  CreateListBody,
  StatusBody,
} from '../src/types/contracts.js';

describe('src/types/contracts', () => {
  it('Todo has expected shape', () => {
    const t: Todo = { id: 1, title: 'Buy milk', done: false };
    expect(t.id).toBe(1);
    expect(t.title).toBe('Buy milk');
    expect(t.done).toBe(false);
  });
  it('TodoList has expected shape', () => {
    const l: TodoList = { id: 2, name: 'Groceries' };
    expect(l.id).toBe(2);
    expect(l.name).toBe('Groceries');
  });
  it('ErrorBody has error field', () => {
    const e: ErrorBody = { error: 'Not found' };
    expect(e.error).toBe('Not found');
  });
  it('CreateTodoBody has title', () => {
    const b: CreateTodoBody = { title: 'x' };
    expect(b.title).toBe('x');
  });
  it('CreateListBody has name', () => {
    const b: CreateListBody = { name: 'y' };
    expect(b.name).toBe('y');
  });
  it('StatusBody brandColor is #3a86ff', () => {
    const s: StatusBody = { version: '1.0', uptimeSeconds: 0, brandColor: '#3a86ff' };
    expect(s.brandColor).toBe('#3a86ff');
  });
});

// ── src/lib/env ───────────────────────────────────────────────────────────
import { requireEnv, optionalEnv, databaseUrl } from '../src/lib/env.js';

describe('src/lib/env', () => {
  const KEYS = ['SOME_VAR', 'MISSING_VAR', 'EMPTY_VAR', 'OPT_VAR', 'OPT_MISSING', 'DATABASE_URL'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) saved[k] = process.env[k]; });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('requireEnv returns value', () => {
    process.env['SOME_VAR'] = 'hello';
    expect(requireEnv('SOME_VAR')).toBe('hello');
  });
  it('requireEnv throws when missing', () => {
    delete process.env['MISSING_VAR'];
    expect(() => requireEnv('MISSING_VAR')).toThrow(/MISSING_VAR/);
  });
  it('requireEnv throws when empty', () => {
    process.env['EMPTY_VAR'] = '';
    expect(() => requireEnv('EMPTY_VAR')).toThrow(/EMPTY_VAR/);
  });
  it('optionalEnv returns value', () => {
    process.env['OPT_VAR'] = 'world';
    expect(optionalEnv('OPT_VAR')).toBe('world');
  });
  it('optionalEnv returns undefined', () => {
    delete process.env['OPT_MISSING'];
    expect(optionalEnv('OPT_MISSING')).toBeUndefined();
  });
  it('optionalEnv returns default', () => {
    delete process.env['OPT_MISSING'];
    expect(optionalEnv('OPT_MISSING', 'fallback')).toBe('fallback');
  });
  it('databaseUrl returns DATABASE_URL', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    expect(databaseUrl()).toBe('postgres://localhost/test');
  });
  it('databaseUrl throws when missing', () => {
    delete process.env['DATABASE_URL'];
    expect(() => databaseUrl()).toThrow(/DATABASE_URL/);
  });
});

// ── src/db/pool ───────────────────────────────────────────────────────────
import { setPool, closePool, getPool } from '../src/db/pool.js';
import type { DbPool, QueryResult } from '../src/db/pool.js';

describe('src/db/pool', () => {
  afterEach(async () => { await closePool(); });

  it('setPool/getPool round-trip', async () => {
    const fake: DbPool = {
      async query<T>(): Promise<QueryResult<T>> { return { rows: [], rowCount: 0 }; },
      async end() {},
    };
    setPool(fake);
    expect(await getPool()).toBe(fake);
  });
  it('closePool calls end()', async () => {
    const calls: boolean[] = [];
    const fake: DbPool = {
      async query<T>(): Promise<QueryResult<T>> { return { rows: [], rowCount: 0 }; },
      async end() { calls.push(true); },
    };
    setPool(fake);
    await closePool();
    expect(calls).toHaveLength(1);
  });
  it('closePool idempotent when empty', async () => {
    await expect(closePool()).resolves.toBeUndefined();
  });
});

// ── src/middleware/auth ───────────────────────────────────────────────────
import { extractBearerToken, requireAuth, envAuth } from '../src/middleware/auth.js';

function makeMockRes() {
  const r = {
    _status: 0 as number,
    _body: '' as string,
    headersSent: false,
    writeHead(s: number) { r._status = s; },
    end(b?: string) { r._body = b ?? ''; },
  };
  return r;
}
function makeReq(auth?: string) {
  return {
    headers: auth ? { authorization: auth } : {},
    params: {},
    body: undefined,
  } as Parameters<typeof extractBearerToken>[0];
}

describe('extractBearerToken', () => {
  it('extracts token', () => {
    expect(extractBearerToken(makeReq('Bearer abc'))).toBe('abc');
  });
  it('undefined when missing', () => {
    expect(extractBearerToken(makeReq())).toBeUndefined();
  });
  it('undefined for Basic scheme', () => {
    expect(extractBearerToken(makeReq('Basic xyz'))).toBeUndefined();
  });
  it('case-insensitive Bearer', () => {
    expect(extractBearerToken(makeReq('bearer tok'))).toBe('tok');
  });
});

describe('requireAuth', () => {
  it('calls handler with valid token', async () => {
    const called: boolean[] = [];
    const h = requireAuth(new Set(['s']), async (_q, res) => {
      called.push(true);
      res.writeHead(200);
      res.end('{}');
    });
    await h(makeReq('Bearer s'), makeMockRes() as unknown as ServerResponse);
    expect(called).toHaveLength(1);
  });
  it('401 with invalid token', async () => {
    const h = requireAuth(new Set(['s']), async (_q, res) => { res.writeHead(200); res.end('{}'); });
    const res = makeMockRes();
    await h(makeReq('Bearer bad'), res as unknown as ServerResponse);
    expect(res._status).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: 'Unauthorized' });
  });
  it('401 with no token', async () => {
    const h = requireAuth(new Set(['s']), async (_q, res) => { res.writeHead(200); res.end('{}'); });
    const res = makeMockRes();
    await h(makeReq(), res as unknown as ServerResponse);
    expect(res._status).toBe(401);
  });
});

describe('envAuth', () => {
  const savedToken = process.env['API_TOKEN'];
  afterEach(() => {
    if (savedToken === undefined) delete process.env['API_TOKEN'];
    else process.env['API_TOKEN'] = savedToken;
  });

  it('accepts when API_TOKEN matches', async () => {
    process.env['API_TOKEN'] = 'tok';
    const called: boolean[] = [];
    const h = envAuth(async (_q, res) => { called.push(true); res.writeHead(200); res.end('{}'); });
    const res = makeMockRes();
    await h(makeReq('Bearer tok'), res as unknown as ServerResponse);
    expect(called).toHaveLength(1);
  });
  it('rejects when API_TOKEN unset', async () => {
    delete process.env['API_TOKEN'];
    const h = envAuth(async (_q, res) => { res.writeHead(200); res.end('{}'); });
    const res = makeMockRes();
    await h(makeReq('Bearer x'), res as unknown as ServerResponse);
    expect(res._status).toBe(401);
  });
});

// ── src/db/migrate (structural exports only) ─────────────────────────────
import { runMigrations, dropSchema } from '../src/db/migrate.js';

describe('src/db/migrate exports', () => {
  it('runMigrations is a function', () => {
    expect(typeof runMigrations).toBe('function');
  });
  it('dropSchema is a function', () => {
    expect(typeof dropSchema).toBe('function');
  });
});

// ── createServer smoke ────────────────────────────────────────────────────
import { createServer } from '../src/app.js';

describe('createServer smoke', () => {
  it('404 for unknown route', async () => {
    const server = await createServer();
    await new Promise<void>((ok) => server.listen(0, () => ok()));
    const port = (server.address() as { port: number }).port;

    const result = await new Promise<{ status: number; body: unknown }>((ok, fail) => {
      const req = http.request(
        { hostname: 'localhost', port, path: '/no-such-route', method: 'GET' },
        (r) => {
          let raw = '';
          r.on('data', (c: Buffer) => { raw += c.toString(); });
          r.on('end', () => ok({ status: r.statusCode ?? 0, body: JSON.parse(raw) }));
        },
      );
      req.on('error', fail);
      req.end();
    });

    await new Promise<void>((ok, fail) =>
      server.close((e?: Error) => (e ? fail(e) : ok())),
    );

    expect(result.status).toBe(404);
    expect((result.body as { error: string }).error).toBeTruthy();
  });
});
