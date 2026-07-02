// Independent test for Session S0-A — Shared scaffold / infrastructure.
// Exercises the 5 non-seeded owned files without a real Postgres or network.
// Run: npm run test -- tests/S0-A.test.ts

import { describe, it, expect, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// src/lib/env.ts
// ---------------------------------------------------------------------------
describe('src/lib/env.ts', () => {
  afterEach(() => {
    delete process.env['TEST_VAR_S0A'];
    delete process.env['TEST_VAR_S0A_MISSING'];
    delete process.env['TEST_VAR_S0A_OPT'];
    delete process.env['TEST_PORT'];
    delete process.env['TEST_PORT_ABSENT'];
    delete process.env['TEST_PORT_BAD'];
  });

  it('getEnv returns value when var is set', async () => {
    const { getEnv } = await import('../src/lib/env.js');
    process.env['TEST_VAR_S0A'] = 'hello';
    expect(getEnv('TEST_VAR_S0A')).toBe('hello');
  });

  it('getEnv returns fallback when var is absent', async () => {
    const { getEnv } = await import('../src/lib/env.js');
    delete process.env['TEST_VAR_S0A_MISSING'];
    expect(getEnv('TEST_VAR_S0A_MISSING', 'default')).toBe('default');
  });

  it('getEnv throws when var is absent and no fallback', async () => {
    const { getEnv } = await import('../src/lib/env.js');
    delete process.env['TEST_VAR_S0A_MISSING'];
    expect(() => getEnv('TEST_VAR_S0A_MISSING')).toThrow('TEST_VAR_S0A_MISSING');
  });

  it('getEnvOptional returns undefined when var is absent', async () => {
    const { getEnvOptional } = await import('../src/lib/env.js');
    delete process.env['TEST_VAR_S0A_OPT'];
    expect(getEnvOptional('TEST_VAR_S0A_OPT')).toBeUndefined();
  });

  it('getEnvOptional returns value when var is set', async () => {
    const { getEnvOptional } = await import('../src/lib/env.js');
    process.env['TEST_VAR_S0A_OPT'] = 'world';
    expect(getEnvOptional('TEST_VAR_S0A_OPT')).toBe('world');
  });

  it('getEnvInt returns integer value', async () => {
    const { getEnvInt } = await import('../src/lib/env.js');
    process.env['TEST_PORT'] = '8080';
    expect(getEnvInt('TEST_PORT')).toBe(8080);
  });

  it('getEnvInt returns fallback when absent', async () => {
    const { getEnvInt } = await import('../src/lib/env.js');
    delete process.env['TEST_PORT_ABSENT'];
    expect(getEnvInt('TEST_PORT_ABSENT', 3000)).toBe(3000);
  });

  it('getEnvInt throws on non-integer value', async () => {
    const { getEnvInt } = await import('../src/lib/env.js');
    process.env['TEST_PORT_BAD'] = 'notanumber';
    expect(() => getEnvInt('TEST_PORT_BAD')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// src/types/contracts.ts
// ---------------------------------------------------------------------------
describe('src/types/contracts.ts', () => {
  it('module imports without error', async () => {
    const mod = await import('../src/types/contracts.js');
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// src/db/pool.ts
// ---------------------------------------------------------------------------
describe('src/db/pool.ts', () => {
  it('getPool throws before pool is set', async () => {
    vi.resetModules();
    const { getPool } = await import('../src/db/pool.js');
    expect(() => getPool()).toThrow(/not initialised/i);
  });

  it('setPool + getPool round-trip', async () => {
    vi.resetModules();
    const { setPool, getPool } = await import('../src/db/pool.js');
    const stub = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
      end: async () => {},
    };
    setPool(stub);
    expect(getPool()).toBe(stub);
  });

  it('initPool is a no-op when DATABASE_URL is absent', async () => {
    vi.resetModules();
    delete process.env['DATABASE_URL'];
    const { initPool, getPool } = await import('../src/db/pool.js');
    await initPool();
    expect(() => getPool()).toThrow();
  });

  it('closePool is safe to call when pool is null', async () => {
    vi.resetModules();
    delete process.env['DATABASE_URL'];
    const { closePool } = await import('../src/db/pool.js');
    await expect(closePool()).resolves.toBeUndefined();
  });

  it('closePool calls end() and resets the singleton', async () => {
    vi.resetModules();
    const { setPool, closePool, getPool } = await import('../src/db/pool.js');
    let ended = false;
    const stub = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
      end: async () => { ended = true; },
    };
    setPool(stub);
    await closePool();
    expect(ended).toBe(true);
    expect(() => getPool()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// src/db/migrate.ts
// ---------------------------------------------------------------------------
describe('src/db/migrate.ts', () => {
  it('runMigrations issues CREATE TABLE for lists then todos', async () => {
    const { runMigrations } = await import('../src/db/migrate.js');
    const queries: string[] = [];
    const stubPool = {
      query: async (sql: string) => { queries.push(sql); return { rows: [], rowCount: 0 }; },
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
      end: async () => {},
    };
    await runMigrations(stubPool);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/CREATE TABLE IF NOT EXISTS lists/i);
    expect(queries[1]).toMatch(/CREATE TABLE IF NOT EXISTS todos/i);
  });
});

// ---------------------------------------------------------------------------
// src/middleware/auth.ts
// ---------------------------------------------------------------------------
describe('src/middleware/auth.ts', () => {
  function makeRes() {
    const r = { statusCode: 0, body: '' } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    r.writeHead = (c: number) => { r.statusCode = c; };
    r.end = (d?: string) => { r.body = d ?? ''; };
    return r;
  }
  function makeReq(auth?: string) {
    return { headers: auth ? { authorization: auth } : {}, params: {} } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  afterEach(() => { delete process.env['AUTH_TOKEN']; });

  it('passes through when AUTH_TOKEN unset', async () => {
    vi.resetModules();
    const { withAuth } = await import('../src/middleware/auth.js');
    delete process.env['AUTH_TOKEN'];
    let called = false;
    await withAuth(async () => { called = true; })(makeReq(), makeRes());
    expect(called).toBe(true);
  });

  it('allows correct bearer token', async () => {
    vi.resetModules();
    const { withAuth } = await import('../src/middleware/auth.js');
    process.env['AUTH_TOKEN'] = 'secret';
    let called = false;
    await withAuth(async () => { called = true; })(makeReq('Bearer secret'), makeRes());
    expect(called).toBe(true);
  });

  it('returns 401 on wrong token', async () => {
    vi.resetModules();
    const { withAuth } = await import('../src/middleware/auth.js');
    process.env['AUTH_TOKEN'] = 'secret';
    const res = makeRes();
    await withAuth(async () => {})(makeReq('Bearer bad'), res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain('Unauthorized');
  });

  it('returns 401 when Authorization header absent', async () => {
    vi.resetModules();
    const { withAuth } = await import('../src/middleware/auth.js');
    process.env['AUTH_TOKEN'] = 'secret';
    const res = makeRes();
    await withAuth(async () => {})(makeReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it('extractBearer returns token', async () => {
    const { extractBearer } = await import('../src/middleware/auth.js');
    expect(extractBearer({ headers: { authorization: 'Bearer tok' } })).toBe('tok');
  });

  it('extractBearer returns undefined for missing header', async () => {
    const { extractBearer } = await import('../src/middleware/auth.js');
    expect(extractBearer({ headers: {} })).toBeUndefined();
  });

  it('extractBearer returns undefined for non-Bearer scheme', async () => {
    const { extractBearer } = await import('../src/middleware/auth.js');
    expect(extractBearer({ headers: { authorization: 'Basic abc' } })).toBeUndefined();
  });
});

