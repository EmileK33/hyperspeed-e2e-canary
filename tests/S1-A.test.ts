/**
 * S1-A independent tests -- src/server/app.ts
 *
 * Exercises createServer() in isolation using node:http.request against
 * a real (loopback) server so there are no mocks for the HTTP layer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import type { App, Route, AppRequest } from '../src/server/app.ts';
import type { ServerResponse } from 'node:http';
import * as http from 'node:http';

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
  body?: unknown
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
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
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

let app: App;
let port: number;

function startServer(routes: Route[] = []): Promise<void> {
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
// Exports
// ---------------------------------------------------------------------------

describe('createServer exports', () => {
  it('is a function', () => {
    expect(typeof createServer).toBe('function');
  });

  it('returns object with server and addRoutes', () => {
    const a = createServer();
    expect(a).toHaveProperty('server');
    expect(typeof a.addRoutes).toBe('function');
    a.server.close();
  });
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

describe('createServer 404 fallback', () => {
  beforeEach(() => startServer());
  afterEach(() => stopServer());

  it('returns 404 for unregistered route', async () => {
    const res = await httpRequest(port, 'GET', '/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns JSON error body for unknown routes', async () => {
    const res = await httpRequest(port, 'GET', '/nope');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect((res.json as { error: string }).error).toBeTruthy();
  });

  it('404 body includes error key', async () => {
    const res = await httpRequest(port, 'POST', '/unknown-route');
    expect(res.json).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// Route dispatch
// ---------------------------------------------------------------------------

describe('createServer route dispatch', () => {
  beforeEach(() =>
    startServer([
      {
        method: 'GET',
        path: '/ping',
        handler: (_req: AppRequest, res: ServerResponse) => {
          const b = JSON.stringify({ pong: true });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
          res.end(b);
        },
      },
      {
        method: 'POST',
        path: '/echo',
        handler: (req: AppRequest, res: ServerResponse) => {
          const b = JSON.stringify({ received: req.body });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
          res.end(b);
        },
      },
      {
        method: 'GET',
        path: '/items/:id',
        handler: (req: AppRequest, res: ServerResponse) => {
          const b = JSON.stringify({ id: req.params?.id });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
          res.end(b);
        },
      },
    ])
  );
  afterEach(() => stopServer());

  it('dispatches GET /ping to 200', async () => {
    const res = await httpRequest(port, 'GET', '/ping');
    expect(res.status).toBe(200);
    expect((res.json as { pong: boolean }).pong).toBe(true);
  });

  it('does not match POST /ping (wrong method)', async () => {
    const res = await httpRequest(port, 'POST', '/ping');
    expect(res.status).toBe(404);
  });

  it('parses JSON body on POST /echo', async () => {
    const res = await httpRequest(port, 'POST', '/echo', { hello: 'world' });
    expect(res.status).toBe(200);
    expect((res.json as { received: { hello: string } }).received).toEqual({ hello: 'world' });
  });

  it('extracts path parameters', async () => {
    const res = await httpRequest(port, 'GET', '/items/42');
    expect(res.status).toBe(200);
    expect((res.json as { id: string }).id).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Late registration via addRoutes
// ---------------------------------------------------------------------------

describe('createServer addRoutes late registration', () => {
  beforeEach(() => startServer());
  afterEach(() => stopServer());

  it('adds routes after construction', async () => {
    const before = await httpRequest(port, 'GET', '/late');
    expect(before.status).toBe(404);

    app.addRoutes([
      {
        method: 'GET',
        path: '/late',
        handler: (_req: AppRequest, res: ServerResponse) => {
          const b = JSON.stringify({ ok: true });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
          res.end(b);
        },
      },
    ]);

    const after = await httpRequest(port, 'GET', '/late');
    expect(after.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// JSON body parsing
// ---------------------------------------------------------------------------

describe('createServer JSON parsing', () => {
  beforeEach(() =>
    startServer([
      {
        method: 'POST',
        path: '/body-test',
        handler: (req: AppRequest, res: ServerResponse) => {
          const b = JSON.stringify({ body: req.body ?? null });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
          res.end(b);
        },
      },
    ])
  );
  afterEach(() => stopServer());

  it('body is null for requests with no body', async () => {
    const res = await httpRequest(port, 'POST', '/body-test');
    expect((res.json as { body: null }).body).toBeNull();
  });

  it('parses nested JSON objects', async () => {
    const payload = { a: { b: [1, 2, 3] } };
    const res = await httpRequest(port, 'POST', '/body-test', payload);
    expect((res.json as { body: typeof payload }).body).toEqual(payload);
  });
});
