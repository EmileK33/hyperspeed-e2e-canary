// Independent tests for S2-A: health route — src/routes/health.ts
//
// NOTE: The auto-discovery in src/routes/index.ts uses pathToFileURL which
// produces URL-encoded paths (%20 for spaces). On this Windows environment
// vite-node fails to load TypeScript files via those file:// URLs, so
// createServer() from src/app.ts would return an empty route set. We instead
// import the route module directly and mount it into a minimal inline server
// (same dispatch logic as src/app.ts) — this still fully validates that the
// route handler is correct and the exports are properly produced.

import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { compileRoute, matchPath, sendJson, type RouteRequest } from '../src/http.js';
import routes, { healthRouter } from '../src/routes/health.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build and start a minimal http server mounting the given routes. */
async function startServer(routeList: typeof routes): Promise<{ port: number; close: () => Promise<void> }> {
  const compiled = routeList.map((r) => ({ r, c: compileRoute(r.path) }));

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      for (const { r, c } of compiled) {
        if (r.method.toUpperCase() !== method) continue;
        const params = matchPath(c, pathname);
        if (!params) continue;
        const rq = req as RouteRequest;
        rq.params = params;
        rq.body = undefined;
        await r.handler(rq, res);
        return;
      }
      sendJson(res, 404, { error: 'Route not found' });
    } catch {
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal Server Error' });
      else res.end();
    }
  });

  await new Promise<void>((ok) => server.listen(0, () => ok()));
  const port = (server.address() as { port: number }).port;

  return {
    port,
    close: () => new Promise<void>((ok, fail) =>
      server.close((e?: Error) => (e ? fail(e) : ok())),
    ),
  };
}

/** Fire a GET request and return status + parsed JSON body. */
function get(port: number, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((ok, fail) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method: 'GET' },
      (r) => {
        let raw = '';
        r.on('data', (c: Buffer) => { raw += c.toString(); });
        r.on('end', () => ok({ status: r.statusCode ?? 0, body: JSON.parse(raw) }));
      },
    );
    req.on('error', fail);
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('src/routes/health — exports (US-005)', () => {
  it('default-exports an array of Route objects', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('exports healthRouter as a function', () => {
    expect(typeof healthRouter).toBe('function');
  });

  it('healthRouter() returns the same routes array', () => {
    const result = healthRouter();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(routes.length);
  });

  it('registers GET /health route', () => {
    const route = routes.find((r) => r.method.toUpperCase() === 'GET' && r.path === '/health');
    expect(route).toBeDefined();
  });
});

describe('src/routes/health — GET /health (US-005)', () => {
  it('AC-1: GET /health returns 200 with { status: "ok" }', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await get(port, '/health');
      expect(result.status).toBe(200);
      expect((result.body as { status: string }).status).toBe('ok');
    } finally {
      await close();
    }
  });

  it('unknown path returns 404', async () => {
    const { port, close } = await startServer(routes);
    try {
      const result = await get(port, '/not-a-real-path');
      expect(result.status).toBe(404);
    } finally {
      await close();
    }
  });
});
