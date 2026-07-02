/**
 * Independent tests for S2-B: lists routes (src/routes/lists.ts).
 *
 * Vitest's Vite resolver cannot handle URL-encoded spaces (%20) in file://
 * paths, which causes loadRoutes() auto-discovery to silently skip route
 * modules in this build environment. We work around this by directly importing
 * the routes from listsRouter() and mounting them on a minimal test HTTP server
 * that uses the same dispatch helpers (compileRoute, matchPath, readJsonBody,
 * sendJson) as src/app.ts. This still exercises the real route handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { setPool, closePool } from '../src/db/pool.js';
import type { DbPool, QueryResult } from '../src/db/pool.js';
import { listsRouter } from '../src/routes/lists.js';
import {
  compileRoute,
  matchPath,
  readJsonBody,
  sendJson,
  type RouteRequest,
} from '../src/http.js';

// ── Fake in-memory pool ───────────────────────────────────────────────────────

interface ListRow { id: number; name: string }

function makeFakePool(): DbPool {
  let nextId = 1;
  const lists: ListRow[] = [];

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('INSERT INTO LISTS')) {
        const name = params?.[0] as string;
        const row: ListRow = { id: nextId++, name };
        lists.push(row);
        return { rows: [row] as unknown as T[], rowCount: 1 };
      }
      if (s.startsWith('SELECT') && s.includes('FROM LISTS')) {
        const sorted = [...lists].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as T[], rowCount: sorted.length };
      }
      return { rows: [] as unknown as T[], rowCount: 0 };
    },
    async end() {},
  };
}

// ── Minimal test server (same dispatch as src/app.ts) ────────────────────────

function makeTestServer(): http.Server {
  const routes = listsRouter();
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));

  return http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const body =
        method === 'GET' || method === 'HEAD' ? undefined : await readJsonBody(req);
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

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function hit(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'content-type': 'application/json',
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
      },
    };
    const clientReq = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c: Buffer) => { raw += c.toString(); });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
      });
    });
    clientReq.on('error', reject);
    if (payload) clientReq.write(payload);
    clientReq.end();
  });
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────

let server: http.Server;
let port: number;

beforeEach(async () => {
  setPool(makeFakePool());
  server = makeTestServer();
  await new Promise<void>((ok) => server.listen(0, () => ok()));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((ok, fail) =>
    server.close((e?: Error) => (e ? fail(e) : ok())),
  );
  await closePool();
});

// ── Export shape ──────────────────────────────────────────────────────────────

describe('listsRouter export', () => {
  it('is a function', () => {
    expect(typeof listsRouter).toBe('function');
  });

  it('returns an array of Route objects', () => {
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('includes GET /lists and POST /lists', () => {
    const routes = listsRouter();
    const keys = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`);
    expect(keys).toContain('GET /lists');
    expect(keys).toContain('POST /lists');
  });
});

// ── GET /lists ─────────────────────────────────────────────────────────────────

describe('GET /lists', () => {
  it('returns 200 with an empty array when no lists exist', async () => {
    const res = await hit(port, 'GET', '/lists');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all created lists', async () => {
    await hit(port, 'POST', '/lists', { name: 'Work' });
    await hit(port, 'POST', '/lists', { name: 'Personal' });
    const res = await hit(port, 'GET', '/lists');
    expect(res.status).toBe(200);
    const body = res.body as { id: number; name: string }[];
    expect(body).toHaveLength(2);
    expect(body.map((l) => l.name)).toContain('Work');
    expect(body.map((l) => l.name)).toContain('Personal');
  });

  it('returns lists ordered by id ascending', async () => {
    await hit(port, 'POST', '/lists', { name: 'Alpha' });
    await hit(port, 'POST', '/lists', { name: 'Beta' });
    const res = await hit(port, 'GET', '/lists');
    const body = res.body as { id: number; name: string }[];
    expect(body[0]?.name).toBe('Alpha');
    expect(body[1]?.name).toBe('Beta');
  });

  it('returns TodoList-shaped objects with id and name', async () => {
    await hit(port, 'POST', '/lists', { name: 'Groceries' });
    const res = await hit(port, 'GET', '/lists');
    const [item] = res.body as { id: number; name: string }[];
    expect(typeof item?.id).toBe('number');
    expect(item?.name).toBe('Groceries');
  });
});

// ── POST /lists ────────────────────────────────────────────────────────────────

describe('POST /lists', () => {
  it('returns 201 with the created list', async () => {
    const res = await hit(port, 'POST', '/lists', { name: 'My List' });
    expect(res.status).toBe(201);
    const body = res.body as { id: number; name: string };
    expect(body.name).toBe('My List');
    expect(typeof body.id).toBe('number');
  });

  it('returns 400 when name field is absent', async () => {
    const res = await hit(port, 'POST', '/lists', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is empty string', async () => {
    const res = await hit(port, 'POST', '/lists', { name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing entirely', async () => {
    const res = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const clientReq = http.request(
        {
          hostname: 'localhost', port, path: '/lists', method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        (r) => {
          let raw = '';
          r.on('data', (c: Buffer) => { raw += c.toString(); });
          r.on('end', () => {
            try { resolve({ status: r.statusCode ?? 0, body: JSON.parse(raw) }); }
            catch { resolve({ status: r.statusCode ?? 0, body: raw }); }
          });
        },
      );
      clientReq.on('error', reject);
      clientReq.end();
    });
    expect(res.status).toBe(400);
  });

  it('trims whitespace from name', async () => {
    const res = await hit(port, 'POST', '/lists', { name: '  Trimmed  ' });
    expect(res.status).toBe(201);
    const body = res.body as { name: string };
    expect(body.name).toBe('Trimmed');
  });

  it('persists the created list (visible in GET /lists)', async () => {
    await hit(port, 'POST', '/lists', { name: 'Persist me' });
    const listRes = await hit(port, 'GET', '/lists');
    const lists = listRes.body as { name: string }[];
    expect(lists.some((l) => l.name === 'Persist me')).toBe(true);
  });

  it('returns 404 for unsupported method DELETE /lists', async () => {
    const res = await hit(port, 'DELETE', '/lists');
    expect(res.status).toBe(404);
  });
});
