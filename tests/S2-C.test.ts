/**
 * S2-C independent tests — src/routes/status.ts
 *
 * Exercises the GET /status endpoint via the real createServer from
 * src/server/app.ts, hitting a live loopback server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type App } from '../src/server/app.ts';
import { statusRouter } from '../src/routes/status.ts';
import defaultRoutes from '../src/routes/status.ts';
import * as http from 'node:http';

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
  path: string
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      method,
      path,
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
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let app: App;
let port: number;

beforeAll(() => {
  app = createServer();
  statusRouter(app.addRoutes);
  return new Promise<void>((resolve) => {
    app.server.listen(0, '127.0.0.1', () => {
      const addr = app.server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve, reject) => {
    app.server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('statusRouter exports', () => {
  it('is a function', async () => {
    const { statusRouter: sr } = await import('../src/routes/status.ts');
    expect(typeof sr).toBe('function');
  });

  it('default export is an array', () => {
    expect(Array.isArray(defaultRoutes)).toBe(true);
  });

  it('default export contains a GET /status route', () => {
    const route = defaultRoutes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/status'
    );
    expect(route).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /status
// ---------------------------------------------------------------------------

describe('GET /status', () => {
  it('returns 200', async () => {
    const res = await httpRequest(port, 'GET', '/status');
    expect(res.status).toBe(200);
  });

  it('returns { status: "ok" }', async () => {
    const res = await httpRequest(port, 'GET', '/status');
    expect((res.json as { status: string }).status).toBe('ok');
  });

  it('responds with JSON content-type', async () => {
    const res = await httpRequest(port, 'GET', '/status');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('body is valid JSON', async () => {
    const res = await httpRequest(port, 'GET', '/status');
    expect(res.json).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wrong methods → 404 (no auth middleware on this route)
// ---------------------------------------------------------------------------

describe('unsupported methods on /status', () => {
  it('POST /status returns 404', async () => {
    const res = await httpRequest(port, 'POST', '/status');
    expect(res.status).toBe(404);
  });

  it('DELETE /status returns 404', async () => {
    const res = await httpRequest(port, 'DELETE', '/status');
    expect(res.status).toBe(404);
  });
});
