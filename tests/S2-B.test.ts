// Independent test for Session S2-B — lists routes.
// Exercises GET /lists and POST /lists over HTTP using a stub pool.
//
// NOTE: The project path contains spaces. This causes a known vite-node bug:
// pathToFileURL() percent-encodes spaces to %20, producing a file:// URL that
// vite-node's resolver cannot map back to the filesystem path, so the
// auto-discovery in src/routes/index.ts silently skips lists.ts. Workaround:
// we import the route module directly (a normal relative import that vite-node
// handles fine) and build a minimal HTTP server using the same routing
// primitives from src/http.ts (compileRoute + matchPath + readJsonBody) —
// identical to the dispatch loop in src/app.ts.
//
// Run: npm run test -- tests/S2-B.test.ts

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { compileRoute, matchPath, readJsonBody, sendJson } from '../src/http.js';
import type { Route } from '../src/http.js';

// ---------------------------------------------------------------------------
// Stub pool
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeStubPool(rows: any[] = [], rowCount = rows.length) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: vi.fn(async () => ({ rows, rowCount })) as any,
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
    end: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Minimal HTTP server that mounts a Route[] — mirrors src/app.ts dispatch logic
// ---------------------------------------------------------------------------

function buildServer(routes: Route[]): http.Server {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rq = req as any;
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
// Server lifecycle
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  // Inject stub pool before importing the route module.
  const { setPool } = await import('../src/db/pool.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPool(makeStubPool([]) as any);

  // Import lists route module via normal relative import (vite-node handles this).
  const mod = await import('../src/routes/lists.js');
  const routes: Route[] = Array.isArray(mod.default) ? mod.default : [];

  server = buildServer(routes);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function getReq(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { body = null; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    }).on('error', reject);
  });
}

function postReq(path: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { body = null; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// listsRouter named export
// ---------------------------------------------------------------------------

describe('listsRouter export', () => {
  it('is exported as a function from src/routes/lists.ts', async () => {
    const mod = await import('../src/routes/lists.js');
    expect(typeof mod.listsRouter).toBe('function');
  });

  it('listsRouter() returns a Route array', async () => {
    const { listsRouter } = await import('../src/routes/lists.js');
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('routes include GET /lists and POST /lists', async () => {
    const { listsRouter } = await import('../src/routes/lists.js');
    const sigs = listsRouter().map((r) => `${r.method.toUpperCase()} ${r.path}`);
    expect(sigs).toContain('GET /lists');
    expect(sigs).toContain('POST /lists');
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('default export', () => {
  it('is an array of Route objects', async () => {
    const mod = await import('../src/routes/lists.js');
    expect(Array.isArray(mod.default)).toBe(true);
    for (const r of mod.default as Route[]) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// GET /lists
// ---------------------------------------------------------------------------

describe('GET /lists', () => {
  it('returns 200 with an empty array when no lists exist', async () => {
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool([]) as any);

    const { status, body } = await getReq('/lists');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns existing lists from the store', async () => {
    const rows = [
      { id: 1, name: 'Work', created_at: '2026-01-01' },
      { id: 2, name: 'Personal', created_at: '2026-01-02' },
    ];
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool(rows) as any);

    const { status, body } = await getReq('/lists');
    expect(status).toBe(200);
    expect(body).toEqual(rows);
  });

  it('Content-Type is application/json', async () => {
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool([]) as any);
    await new Promise<void>((resolve, reject) => {
      http.get(`${baseUrl}/lists`, (res) => {
        res.resume();
        res.on('end', () => {
          expect(res.headers['content-type']).toContain('application/json');
          resolve();
        });
      }).on('error', reject);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /lists
// ---------------------------------------------------------------------------

describe('POST /lists', () => {
  it('returns 201 with the created list', async () => {
    const created = { id: 3, name: 'Shopping', created_at: '2026-01-03' };
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool([created]) as any);

    const { status, body } = await postReq('/lists', { name: 'Shopping' });
    expect(status).toBe(201);
    expect(body).toEqual(created);
  });

  it('returns 400 when name field is missing', async () => {
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool([]) as any);

    const { status, body } = await postReq('/lists', {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBeTruthy();
  });

  it('returns 400 when name is blank whitespace', async () => {
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPool(makeStubPool([]) as any);

    const { status } = await postReq('/lists', { name: '   ' });
    expect(status).toBe(400);
  });

  it('trims whitespace before inserting', async () => {
    const created = { id: 4, name: 'Groceries', created_at: '2026-01-04' };
    const { setPool } = await import('../src/db/pool.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = makeStubPool([created]) as any;
    setPool(pool);

    const { status, body } = await postReq('/lists', { name: '  Groceries  ' });
    expect(status).toBe(201);
    expect((body as { name: string }).name).toBe('Groceries');
    const [, params] = pool.query.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('Groceries');
  });

  it('returns 400 when body is absent', async () => {
    const { status } = await new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request(`${baseUrl}/lists`, {
        method: 'POST',
        headers: { 'content-length': '0' },
      }, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(400);
  });
});
