import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Todo,
  TodoList,
  Route,
  RouteContext,
  ApiError,
  PaginatedResponse,
  HttpMethod,
  RouteHandler,
} from '../src/types/contracts.ts';
import {
  getEnv,
  getEnvOptional,
  getEnvInt,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  NODE_ENV,
} from '../src/lib/env.ts';
import { setPool, getPool, resetPool, createNullPool } from '../src/db/pool.ts';
import { runMigrations, listAppliedMigrations } from '../src/db/migrate.ts';
import { withAuth, requireAuth, optionalAuth } from '../src/middleware/auth.ts';
import { registerRoutes, getRoutes, clearRoutes } from '../src/routes/index.ts';
import { createApp } from '../src/app.ts';
import { buildServer, listen } from '../src/server.ts';

// ---------------------------------------------------------------------------

describe('S0-A: shared scaffold / infrastructure', () => {

  // ── src/types/contracts.ts ──────────────────────────────────────────────
  describe('src/types/contracts.ts', () => {
    it('exports Todo shape', () => {
      const todo: Todo = {
        id: '1',
        title: 'Buy milk',
        completed: false,
        createdAt: new Date().toISOString(),
      };
      expect(todo.id).toBe('1');
      expect(todo.completed).toBe(false);
    });

    it('exports TodoList shape', () => {
      const list: TodoList = {
        id: 'l1',
        name: 'Groceries',
        createdAt: new Date().toISOString(),
      };
      expect(list.name).toBe('Groceries');
    });

    it('exports ApiError shape', () => {
      const err: ApiError = { error: 'Not found', code: 'NOT_FOUND' };
      expect(err.code).toBe('NOT_FOUND');
    });

    it('HttpMethod union covers standard verbs', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      expect(methods).toHaveLength(5);
    });

    it('exports PaginatedResponse shape', () => {
      const todo: Todo = { id: '1', title: 'T', completed: false, createdAt: '' };
      const p: PaginatedResponse<Todo> = { items: [todo], total: 1, page: 1, pageSize: 20 };
      expect(p.items).toHaveLength(1);
    });
  });

  // ── src/lib/env.ts ───────────────────────────────────────────────────────
  describe('src/lib/env.ts', () => {
    it('getEnv returns value when set', () => {
      process.env['_TEST_KEY_'] = 'hello';
      expect(getEnv('_TEST_KEY_')).toBe('hello');
      delete process.env['_TEST_KEY_'];
    });

    it('getEnv returns fallback when absent', () => {
      delete process.env['_MISSING_KEY_'];
      expect(getEnv('_MISSING_KEY_', 'fallback')).toBe('fallback');
    });

    it('getEnv throws for missing required variable', () => {
      delete process.env['_REQUIRED_KEY_'];
      expect(() => getEnv('_REQUIRED_KEY_')).toThrow('_REQUIRED_KEY_');
    });

    it('getEnvOptional returns undefined for absent', () => {
      delete process.env['_OPT_KEY_'];
      expect(getEnvOptional('_OPT_KEY_')).toBeUndefined();
    });

    it('getEnvInt parses integer', () => {
      process.env['_INT_KEY_'] = '42';
      expect(getEnvInt('_INT_KEY_')).toBe(42);
      delete process.env['_INT_KEY_'];
    });

    it('getEnvInt uses fallback when unset', () => {
      delete process.env['_INT_KEY_'];
      expect(getEnvInt('_INT_KEY_', 99)).toBe(99);
    });

    it('getEnvInt throws on non-integer', () => {
      process.env['_INT_KEY_'] = 'nan';
      expect(() => getEnvInt('_INT_KEY_')).toThrow();
      delete process.env['_INT_KEY_'];
    });

    it('PORT is a finite number', () => {
      expect(typeof PORT).toBe('number');
      expect(Number.isFinite(PORT)).toBe(true);
    });

    it('DATABASE_URL is a string', () => {
      expect(typeof DATABASE_URL).toBe('string');
    });

    it('JWT_SECRET is non-empty', () => {
      expect(JWT_SECRET.length).toBeGreaterThan(0);
    });

    it('NODE_ENV is a string', () => {
      expect(typeof NODE_ENV).toBe('string');
    });
  });

  // ── src/db/pool.ts ───────────────────────────────────────────────────────
  describe('src/db/pool.ts', () => {
    beforeEach(() => resetPool());

    it('getPool throws before setPool', () => {
      expect(() => getPool()).toThrow('not initialised');
    });

    it('setPool / getPool round-trip', () => {
      const pool = createNullPool();
      setPool(pool);
      expect(getPool()).toBe(pool);
    });

    it('createNullPool query returns empty rows', async () => {
      const r = await createNullPool().query('SELECT 1');
      expect(r.rows).toEqual([]);
      expect(r.rowCount).toBe(0);
    });

    it('createNullPool end resolves', async () => {
      await expect(createNullPool().end()).resolves.toBeUndefined();
    });

    it('createNullPool connect provides client with release', async () => {
      const c = await createNullPool().connect();
      expect(typeof c.release).toBe('function');
    });

    it('resetPool clears singleton', () => {
      setPool(createNullPool());
      resetPool();
      expect(() => getPool()).toThrow();
    });
  });

  // ── src/db/migrate.ts ────────────────────────────────────────────────────
  describe('src/db/migrate.ts', () => {
    it('runMigrations applies both migrations on fresh pool', async () => {
      const pool = {
        query: async (_sql: string) => ({ rows: [], rowCount: 0 }),
        end: async () => {},
        connect: async () => ({
          query: async () => ({ rows: [], rowCount: 0 }),
          release: () => {},
        }),
      };
      const result = await runMigrations(pool);
      expect(result.applied).toHaveLength(2);
      expect(result.applied[0]).toBe('001_create_lists');
      expect(result.applied[1]).toBe('002_create_todos');
    });

    it('runMigrations skips already-applied migrations', async () => {
      const pool = {
        query: async (sql: string) => {
          if (sql.includes('SELECT name FROM _migrations')) {
            return { rows: [{ name: 'x' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        end: async () => {},
        connect: async () => ({
          query: async () => ({ rows: [], rowCount: 0 }),
          release: () => {},
        }),
      };
      const result = await runMigrations(pool);
      expect(result.skipped).toHaveLength(2);
      expect(result.applied).toHaveLength(0);
    });

    it('listAppliedMigrations maps rows correctly', async () => {
      const pool = {
        query: async () => ({
          rows: [{ name: '001', applied_at: '2026-01-01T00:00:00Z' }],
          rowCount: 1,
        }),
        end: async () => {},
        connect: async () => ({
          query: async () => ({ rows: [], rowCount: 0 }),
          release: () => {},
        }),
      };
      const recs = await listAppliedMigrations(pool);
      expect(recs[0]!.name).toBe('001');
      expect(recs[0]!.appliedAt).toBe('2026-01-01T00:00:00Z');
    });
  });

  // ── src/middleware/auth.ts ───────────────────────────────────────────────
  describe('src/middleware/auth.ts', () => {
    const okHandler: RouteHandler = async () => ({ status: 200, body: { ok: true } });

    const makeCtx = (h?: string): RouteContext => ({
      params: {},
      body: undefined,
      query: {},
      headers: h ? { authorization: h } : {},
    });

    it('optionalAuth passes with no header', async () => {
      expect((await optionalAuth(okHandler)(makeCtx())).status).toBe(200);
    });

    it('optionalAuth passes with Bearer token', async () => {
      expect((await optionalAuth(okHandler)(makeCtx('Bearer tok'))).status).toBe(200);
    });

    it('requireAuth returns 401 with no header', async () => {
      expect((await requireAuth(okHandler)(makeCtx())).status).toBe(401);
    });

    it('requireAuth passes with Bearer token', async () => {
      expect((await requireAuth(okHandler)(makeCtx('Bearer tok'))).status).toBe(200);
    });

    it('withAuth returns 401 for non-Bearer scheme', async () => {
      expect(
        (await withAuth(okHandler, { required: false })(makeCtx('Basic abc'))).status
      ).toBe(401);
    });

    it('withAuth returns 401 for empty Bearer', async () => {
      expect(
        (await withAuth(okHandler, { required: false })(makeCtx('Bearer '))).status
      ).toBe(401);
    });
  });

  // ── src/routes/index.ts ──────────────────────────────────────────────────
  describe('src/routes/index.ts', () => {
    beforeEach(() => clearRoutes());

    it('starts empty', () => {
      expect(getRoutes()).toHaveLength(0);
    });

    it('registerRoutes adds routes', () => {
      const r: Route = {
        method: 'GET',
        path: '/t',
        handler: async () => ({ status: 200, body: {} }),
      };
      registerRoutes([r]);
      expect(getRoutes()).toHaveLength(1);
    });

    it('clearRoutes empties registry', () => {
      registerRoutes([
        { method: 'GET', path: '/a', handler: async () => ({ status: 200, body: {} }) },
        { method: 'POST', path: '/b', handler: async () => ({ status: 201, body: {} }) },
      ]);
      clearRoutes();
      expect(getRoutes()).toHaveLength(0);
    });
  });

  // ── src/app.ts ───────────────────────────────────────────────────────────
  describe('src/app.ts', () => {
    beforeEach(() => clearRoutes());

    it('returns 404 with no routes', async () => {
      const res = await createApp().handle('GET', '/x', undefined, {});
      expect(res.status).toBe(404);
    });

    it('dispatches to registered route', async () => {
      registerRoutes([{
        method: 'GET',
        path: '/hello',
        handler: async () => ({ status: 200, body: { msg: 'hi' } }),
      }]);
      const res = await createApp().handle('GET', '/hello', undefined, {});
      expect(res.status).toBe(200);
      expect((res.body as { msg: string }).msg).toBe('hi');
    });

    it('extracts :param segments', async () => {
      registerRoutes([{
        method: 'GET',
        path: '/items/:id',
        handler: async (ctx) => ({ status: 200, body: { id: ctx.params['id'] } }),
      }]);
      const res = await createApp().handle('GET', '/items/42', undefined, {});
      expect((res.body as { id: string }).id).toBe('42');
    });

    it('returns 404 for wrong method', async () => {
      registerRoutes([{
        method: 'POST',
        path: '/p',
        handler: async () => ({ status: 201, body: {} }),
      }]);
      expect((await createApp().handle('GET', '/p', undefined, {})).status).toBe(404);
    });

    it('addRoute scoped to app instance', async () => {
      const app = createApp();
      app.addRoute({
        method: 'DELETE',
        path: '/local',
        handler: async () => ({ status: 204, body: null }),
      });
      expect((await app.handle('DELETE', '/local', undefined, {})).status).toBe(204);
    });

    it('returns 500 when handler throws', async () => {
      registerRoutes([{
        method: 'GET',
        path: '/boom',
        handler: async () => { throw new Error('kaboom'); },
      }]);
      expect((await createApp().handle('GET', '/boom', undefined, {})).status).toBe(500);
    });

    it('parses query string', async () => {
      registerRoutes([{
        method: 'GET',
        path: '/search',
        handler: async (ctx) => ({ status: 200, body: { q: ctx.query['q'] } }),
      }]);
      const res = await createApp().handle('GET', '/search?q=vitest', undefined, {});
      expect((res.body as { q: string }).q).toBe('vitest');
    });
  });

  // ── src/server.ts ────────────────────────────────────────────────────────
  describe('src/server.ts', () => {
    it('exports buildServer as function', () => {
      expect(typeof buildServer).toBe('function');
    });

    it('exports listen as function', () => {
      expect(typeof listen).toBe('function');
    });

    it('buildServer returns { server, app }', () => {
      clearRoutes();
      const { server, app } = buildServer();
      expect(server).toBeDefined();
      expect(typeof app.handle).toBe('function');
      server.close();
    });
  });

});
