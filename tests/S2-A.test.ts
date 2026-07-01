/**
 * S2-A independent tests — src/routes/health.ts
 *
 * Exercises the GET /health endpoint via the real createServer from
 * src/server/app.ts, hitting a live loopback server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type App } from '../src/server/app.ts';
import { healthRouter } from '../src/routes/health.ts';
import defaultRoutes from '../src/routes/health.ts';
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
  healthRouter(app.addRoutes);
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

describe('healthRouter exports', () => {
  it('is a function', async () => {
    const { healthRouter: hr } = await import('../src/routes/health.ts');
    expect(typeof hr).toBe('function');
  });

  it('default export is an array', () => {
    expect(Array.isArray(defaultRoutes)).toBe(true);
  });

  it('default export contains a GET /health route', () => {
    const route = defaultRoutes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/health'
    );
    expect(route).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await httpRequest(port, 'GET', '/health');
    expect(res.status).toBe(200);
  });

  it('returns { status: "ok" }', async () => {
    const res = await httpRequest(port, 'GET', '/health');
    expect((res.json as { status: string }).status).toBe('ok');
  });

  it('responds with JSON content-type', async () => {
    const res = await httpRequest(port, 'GET', '/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('body is valid JSON', async () => {
    const res = await httpRequest(port, 'GET', '/health');
    expect(res.json).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wrong methods → 404 (no auth middleware on this route)
// ---------------------------------------------------------------------------

describe('unsupported methods on /health', () => {
  it('POST /health returns 404', async () => {
    const res = await httpRequest(port, 'POST', '/health');
    expect(res.status).toBe(404);
  });

  it('DELETE /health returns 404', async () => {
    const res = await httpRequest(port, 'DELETE', '/health');
    expect(res.status).toBe(404);
  });
});
