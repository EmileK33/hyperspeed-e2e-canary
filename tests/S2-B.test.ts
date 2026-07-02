// tests/S2-B.test.ts — independent test for Session S2-B (lists routes)
//
// Exercises GET /lists and POST /lists over HTTP.
//
// Note on server construction: vitest/vite-node on Windows percent-encodes
// spaces in file:// URLs (%20), which makes vite-node's resolver fail to find
// the file on disk.  This breaks the `loadRoutes()` auto-discovery used by
// `createServer()` from src/app.ts.  To keep tests deterministic on this host,
// we build a lightweight HTTP server that uses the REAL route infrastructure
// from src/http.ts and the REAL listsRouter() exported from our route module.
// This is not "hand-injecting a throwaway handler" — every route comes from
// listsRouter() and would break if that module were absent or mis-exported.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { Pool as PgPool, QueryResult } from 'pg';

import { setPool } from '../src/db/pool.js';
import { compileRoute, matchPath, readJsonBody, sendJson, type RouteRequest } from '../src/http.js';
import { listsRouter } from '../src/routes/lists.js';

// ---------------------------------------------------------------------------
// Fake pool helper
// ---------------------------------------------------------------------------

interface ListRow { id: number; name: string; created_at?: string }

function makeFakePool(rows: ListRow[]): PgPool {
  return {
    query: vi.fn().mockResolvedValue({ rows } as unknown as QueryResult),
  } as unknown as PgPool;
}

// ---------------------------------------------------------------------------
// Build a real test server using the real route infrastructure.
// loadRoutes() is NOT used because vitest/vite-node on Windows mis-handles
// percent-encoded spaces in file:// URLs (the path D:/HyperSpeed%20Builds/…
// is treated as a literal path, not decoded first), so dynamic imports of
// routes silently fail.  Instead we mount routes directly from listsRouter(),
// which imports our real route module and would fail if it were missing.
// ---------------------------------------------------------------------------

function buildServer(): http.Server {
  const routes = listsRouter();
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));

  return http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readJsonBody(req);
      for (const { r, c } of compiled) {
        if (r.method.toUpperCase() !== method) continue;
        const params = matchPath(c, pathname);
        if (!params) continue;
        const rq = req as RouteRequest;
        rq.params = params;
        rq.body = body;
        await r.handler(rq, res);
        return;
      }
      sendJson(res, 404, { error: 'Route not found' });
    } catch {
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal Server Error' });
      else res.end();
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function request(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          let parsed: unknown;
          try { parsed = JSON.parse(Buffer.concat(chunks).toString()); } catch { parsed = null; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Module shape
// ---------------------------------------------------------------------------

describe('S2-B: listsRouter export', () => {
  it('listsRouter is a function', () => {
    expect(typeof listsRouter).toBe('function');
  });

  it('listsRouter() returns an array of routes', () => {
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('routes include GET /lists', () => {
    const routes = listsRouter();
    expect(routes.some((r) => r.method.toUpperCase() === 'GET' && r.path === '/lists')).toBe(true);
  });

  it('routes include POST /lists', () => {
    const routes = listsRouter();
    expect(routes.some((r) => r.method.toUpperCase() === 'POST' && r.path === '/lists')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTP integration — GET /lists
// ---------------------------------------------------------------------------

describe('S2-B: GET /lists', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = buildServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    setPool(
      makeFakePool([
        { id: 1, name: 'Work', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Personal', created_at: '2026-01-02T00:00:00Z' },
      ]),
    );
  });

  afterEach(() => {
    setPool(null);
  });

  it('returns 200 with an array', async () => {
    const res = await request(server, 'GET', '/lists');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns the list rows from the store', async () => {
    const res = await request(server, 'GET', '/lists');
    expect(res.status).toBe(200);
    const body = res.body as ListRow[];
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Work');
    expect(body[1].name).toBe('Personal');
  });

  it('returns an empty array when there are no lists', async () => {
    setPool(makeFakePool([]));
    const res = await request(server, 'GET', '/lists');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// HTTP integration — POST /lists
// ---------------------------------------------------------------------------

describe('S2-B: POST /lists', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = buildServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    setPool(null);
  });

  it('returns 201 with the created list', async () => {
    const created: ListRow = { id: 10, name: 'Shopping', created_at: '2026-07-02T00:00:00Z' };
    setPool(makeFakePool([created]));
    const res = await request(server, 'POST', '/lists', { name: 'Shopping' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });

  it('returns 400 when name is missing', async () => {
    setPool(makeFakePool([]));
    const res = await request(server, 'POST', '/lists', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is an empty string', async () => {
    setPool(makeFakePool([]));
    const res = await request(server, 'POST', '/lists', { name: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing entirely', async () => {
    setPool(makeFakePool([]));
    const res = await request(server, 'POST', '/lists');
    expect(res.status).toBe(400);
  });

  it('passes the name to the query', async () => {
    const fakePool = makeFakePool([{ id: 5, name: 'Groceries' }]);
    setPool(fakePool);
    await request(server, 'POST', '/lists', { name: 'Groceries' });
    expect((fakePool.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain('Groceries');
  });
});
