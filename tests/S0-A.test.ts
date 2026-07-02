// tests/S0-A.test.ts — independent test for Session S0-A (shared scaffold)
//
// Exercises every owned module in isolation.  No real Postgres connection
// is made; the pool module uses a dynamic import that is never triggered
// here because setPool/closePool are tested without reaching the pg path.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── src/lib/env.ts ────────────────────────────────────────────────────────────
import { requireEnv, getEnv } from '../src/lib/env.js';

// ── src/types/contracts.ts ────────────────────────────────────────────────────
import type { Todo, List, ApiError, Pagination } from '../src/types/contracts.js';

// ── src/db/pool.ts ────────────────────────────────────────────────────────────
import { getPool, closePool, setPool } from '../src/db/pool.js';

// ── src/middleware/auth.ts ────────────────────────────────────────────────────
import { withAuth } from '../src/middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('S0-A: Shared scaffold / infrastructure', () => {
  // ── src/lib/env.ts ──────────────────────────────────────────────────────────
  describe('src/lib/env.ts', () => {
    const KEY = '__S0A_TEST_KEY__';

    beforeEach(() => { delete process.env[KEY]; });
    afterEach(() => { delete process.env[KEY]; });

    it('getEnv returns the default when the variable is absent', () => {
      expect(getEnv(KEY, 'fallback')).toBe('fallback');
    });

    it('getEnv returns empty string by default when the variable is absent', () => {
      expect(getEnv(KEY)).toBe('');
    });

    it('getEnv returns the variable value when it is set', () => {
      process.env[KEY] = 'hello';
      expect(getEnv(KEY)).toBe('hello');
    });

    it('requireEnv throws when the variable is absent', () => {
      expect(() => requireEnv(KEY)).toThrow(KEY);
    });

    it('requireEnv returns the variable value when it is set', () => {
      process.env[KEY] = 'world';
      expect(requireEnv(KEY)).toBe('world');
    });
  });

  // ── src/types/contracts.ts ──────────────────────────────────────────────────
  describe('src/types/contracts.ts', () => {
    it('Todo type has the required shape', () => {
      const todo: Todo = { id: 1, title: 'Buy milk', done: false };
      expect(todo.id).toBe(1);
      expect(todo.title).toBe('Buy milk');
      expect(todo.done).toBe(false);
    });

    it('Todo type supports optional created_at', () => {
      const todo: Todo = { id: 2, title: 'Walk dog', done: true, created_at: '2026-01-01T00:00:00Z' };
      expect(todo.created_at).toBeDefined();
    });

    it('List type has the required shape', () => {
      const list: List = { id: 1, name: 'Groceries' };
      expect(list.id).toBe(1);
      expect(list.name).toBe('Groceries');
    });

    it('ApiError type has the required shape', () => {
      const err: ApiError = { error: 'Not found' };
      expect(err.error).toBe('Not found');
    });

    it('Pagination type has the required shape', () => {
      const page: Pagination = { total: 50, offset: 0, limit: 10 };
      expect(page.total).toBe(50);
      expect(page.offset).toBe(0);
      expect(page.limit).toBe(10);
    });
  });

  // ── src/db/pool.ts ──────────────────────────────────────────────────────────
  describe('src/db/pool.ts', () => {
    afterEach(async () => {
      setPool(null);
    });

    it('exports getPool as a function', () => {
      expect(typeof getPool).toBe('function');
    });

    it('exports closePool as a function', () => {
      expect(typeof closePool).toBe('function');
    });

    it('exports setPool as a function', () => {
      expect(typeof setPool).toBe('function');
    });

    it('closePool resolves without error when pool is null', async () => {
      setPool(null);
      await expect(closePool()).resolves.toBeUndefined();
    });

    it('setPool accepts null and subsequent closePool is a no-op', async () => {
      setPool(null);
      setPool(null); // idempotent
      await expect(closePool()).resolves.toBeUndefined();
    });

    it('getPool rejects when DATABASE_URL is unset', async () => {
      const prev = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      setPool(null); // ensure no cached pool
      await expect(getPool()).rejects.toThrow('DATABASE_URL');
      if (prev !== undefined) process.env.DATABASE_URL = prev;
    });
  });

  // ── src/db/migrate.ts ───────────────────────────────────────────────────────
  describe('src/db/migrate.ts', () => {
    it('exports migrate as a function', async () => {
      const { migrate } = await import('../src/db/migrate.js');
      expect(typeof migrate).toBe('function');
    });
  });

  // ── src/middleware/auth.ts ──────────────────────────────────────────────────
  describe('src/middleware/auth.ts', () => {
    afterEach(() => { delete process.env.AUTH_TOKEN; });

    it('exports withAuth as a function', () => {
      expect(typeof withAuth).toBe('function');
    });

    it('withAuth returns a handler function', () => {
      const wrapped = withAuth(async () => {});
      expect(typeof wrapped).toBe('function');
    });

    it('calls inner handler when AUTH_TOKEN is not set', async () => {
      delete process.env.AUTH_TOKEN;
      let called = false;
      const handler = withAuth(async () => { called = true; });
      const req = { headers: {}, params: {} } as Parameters<typeof handler>[0];
      const res = { headersSent: false, writeHead: () => {}, end: () => {} } as Parameters<typeof handler>[1];
      await handler(req, res);
      expect(called).toBe(true);
    });

    it('returns 401 when AUTH_TOKEN is set but Authorization header is missing', async () => {
      process.env.AUTH_TOKEN = 'mysecret';
      let statusCode = 0;
      const handler = withAuth(async () => {});
      const req = { headers: {}, params: {} } as Parameters<typeof handler>[0];
      const res = {
        headersSent: false,
        writeHead: (s: number) => { statusCode = s; },
        end: (_body: string) => {},
      } as unknown as Parameters<typeof handler>[1];
      await handler(req, res);
      expect(statusCode).toBe(401);
    });

    it('returns 401 when bearer token does not match AUTH_TOKEN', async () => {
      process.env.AUTH_TOKEN = 'mysecret';
      let statusCode = 0;
      const handler = withAuth(async () => {});
      const req = { headers: { authorization: 'Bearer wrongtoken' }, params: {} } as Parameters<typeof handler>[0];
      const res = {
        headersSent: false,
        writeHead: (s: number) => { statusCode = s; },
        end: (_body: string) => {},
      } as unknown as Parameters<typeof handler>[1];
      await handler(req, res);
      expect(statusCode).toBe(401);
    });

    it('calls inner handler when bearer token matches AUTH_TOKEN', async () => {
      process.env.AUTH_TOKEN = 'mysecret';
      let called = false;
      const handler = withAuth(async () => { called = true; });
      const req = {
        headers: { authorization: 'Bearer mysecret' },
        params: {},
      } as Parameters<typeof handler>[0];
      const res = { headersSent: false, writeHead: () => {}, end: () => {} } as Parameters<typeof handler>[1];
      await handler(req, res);
      expect(called).toBe(true);
    });
  });
});
