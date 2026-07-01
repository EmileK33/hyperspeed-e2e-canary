/**
 * S2-B independent tests — src/routes/lists.ts
 *
 * Exercises GET /lists and POST /lists via a real HTTP server using
 * createServer() from src/server/app.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { createServer } from '../src/server/app.ts';
import type { App } from '../src/server/app.ts';
import routes, { listsRouter, _resetStore } from '../src/routes/lists.ts';

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface SimpleResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json: unknown;
}

function httpRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: unknown;
        try { json = JSON.parse(text); } catch { json = null; }
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: text,
          json,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let app: App;
let port: number;

function startServer(): Promise<void> {
  _resetStore();
  app = createServer(routes);
  return new Promise((resolve) => {
    app.server.listen(0, '127.0.0.1', () => {
      const addr = app.server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    app.server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Export contract tests
// ---------------------------------------------------------------------------

describe('lists route module exports', () => {
  it('default export is an array of routes', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('each route has method, path, handler', () => {
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('exports listsRouter as a function', () => {
    expect(typeof listsRouter).toBe('function');
  });

  it('listsRouter() returns the routes array', () => {
    const result = listsRouter();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toBe(routes);
  });

  it('has a GET /lists route', () => {
    const found = routes.find(r => r.method.toUpperCase() === 'GET' && r.path === '/lists');
    expect(found).toBeDefined();
  });

  it('has a POST /lists route', () => {
    const found = routes.find(r => r.method.toUpperCase() === 'POST' && r.path === '/lists');
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /lists
// ---------------------------------------------------------------------------

describe('GET /lists', () => {
  beforeEach(() => startServer());
  afterEach(() => stopServer());

  it('returns 200', async () => {
    const res = await httpRequest(port, 'GET', '/lists');
    expect(res.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const res = await httpRequest(port, 'GET', '/lists');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns an empty array when no lists exist', async () => {
    const res = await httpRequest(port, 'GET', '/lists');
    expect(res.json).toEqual([]);
  });

  it('returns created lists', async () => {
    await httpRequest(port, 'POST', '/lists', { name: 'Shopping' });
    await httpRequest(port, 'POST', '/lists', { name: 'Work' });
    const res = await httpRequest(port, 'GET', '/lists');
    const data = res.json as Array<{ id: number; name: string }>;
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Shopping');
    expect(data[1].name).toBe('Work');
  });
});

// ---------------------------------------------------------------------------
// POST /lists
// ---------------------------------------------------------------------------

describe('POST /lists', () => {
  beforeEach(() => startServer());
  afterEach(() => stopServer());

  it('returns 201 on valid create', async () => {
    const res = await httpRequest(port, 'POST', '/lists', { name: 'My List' });
    expect(res.status).toBe(201);
  });

  it('returns the created list with id and name', async () => {
    const res = await httpRequest(port, 'POST', '/lists', { name: 'My List' });
    const data = res.json as { id: number; name: string; created_at: string };
    expect(data.id).toBeDefined();
    expect(data.name).toBe('My List');
    expect(typeof data.created_at).toBe('string');
  });

  it('assigns incrementing ids', async () => {
    const r1 = await httpRequest(port, 'POST', '/lists', { name: 'Alpha' });
    const r2 = await httpRequest(port, 'POST', '/lists', { name: 'Beta' });
    const d1 = r1.json as { id: number };
    const d2 = r2.json as { id: number };
    expect(d2.id).toBeGreaterThan(d1.id);
  });

  it('returns 400 when name is missing', async () => {
    const res = await httpRequest(port, 'POST', '/lists', {});
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBeTruthy();
  });

  it('returns 400 when name is empty string', async () => {
    const res = await httpRequest(port, 'POST', '/lists', { name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing', async () => {
    const res = await httpRequest(port, 'POST', '/lists');
    expect(res.status).toBe(400);
  });

  it('persists the list so GET /lists returns it', async () => {
    await httpRequest(port, 'POST', '/lists', { name: 'Persisted' });
    const getRes = await httpRequest(port, 'GET', '/lists');
    const data = getRes.json as Array<{ name: string }>;
    expect(data.some(l => l.name === 'Persisted')).toBe(true);
  });
});
