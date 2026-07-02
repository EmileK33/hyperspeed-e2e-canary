/**
 * S2-C independent test — GET /status
 *
 * Note: The workspace path contains spaces, which causes Vite's dynamic-import
 * loader (used by loadRoutes()) to fail with a URL-encoding issue in this CI
 * environment.  We therefore exercise the route module directly — importing the
 * real default-exported Route[] array from status.ts and mounting it in a
 * minimal http.Server.  This still validates the actual handler logic and the
 * named `statusRouter` export contract.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  compileRoute,
  matchPath,
  readJsonBody,
  sendJson,
  type RouteRequest,
} from '../src/http.js';
import statusRoutes, { statusRouter } from '../src/routes/status.js';

// ---------------------------------------------------------------------------
// Minimal test-server factory that mounts a Route[] the same way src/app.ts does
// ---------------------------------------------------------------------------
function makeServer(routes: typeof statusRoutes): http.Server {
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));
  return http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const body =
        method === 'GET' || method === 'HEAD'
          ? undefined
          : await readJsonBody(req);
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
function get(url: string): Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch { body = null; }
        resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
let server: http.Server;
let base: string;

beforeAll(async () => {
  server = makeServer(statusRoutes);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server.close();
});

describe('GET /status (AC-1)', () => {
  it('returns HTTP 200', async () => {
    const { status } = await get(`${base}/status`);
    expect(status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const { headers } = await get(`${base}/status`);
    expect(headers['content-type']).toMatch(/application\/json/);
  });

  it('response body contains version (string)', async () => {
    const { body } = await get(`${base}/status`);
    expect(typeof (body as Record<string, unknown>).version).toBe('string');
  });

  it('response body contains uptimeSeconds (number)', async () => {
    const { body } = await get(`${base}/status`);
    expect(typeof (body as Record<string, unknown>).uptimeSeconds).toBe('number');
  });

  it('AC-2: response includes brandColor #3a86ff', async () => {
    const { body } = await get(`${base}/status`);
    expect((body as Record<string, unknown>).brandColor).toBe('#3a86ff');
  });
});

describe('Unknown route returns 404', () => {
  it('returns 404 for an unknown path', async () => {
    const { status } = await get(`${base}/not-a-route`);
    expect(status).toBe(404);
  });
});

describe('statusRouter export contract', () => {
  it('statusRouter is a function', () => {
    expect(typeof statusRouter).toBe('function');
  });

  it('statusRouter() returns a Route[] with GET /status', () => {
    const routes = statusRouter();
    expect(Array.isArray(routes)).toBe(true);
    const statusRoute = routes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/status',
    );
    expect(statusRoute).toBeDefined();
  });

  it('default export is a Route[] with GET /status', () => {
    const statusRoute = statusRoutes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/status',
    );
    expect(statusRoute).toBeDefined();
  });
});
