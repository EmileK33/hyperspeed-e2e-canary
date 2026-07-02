// Independent test for Session S2-C — GET /status (US-006).
// Run: npm run test -- tests/S2-C.test.ts

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { compileRoute, matchPath, sendJson, type Route, type RouteRequest } from '../src/http.js';

// ---------------------------------------------------------------------------
// Minimal test server that mounts routes from a given array directly.
// We use this because the auto-discovery in loadRoutes() uses pathToFileURL()
// for dynamic imports, which encodes spaces as %20 in file:// URLs — Vite's
// module resolver does not decode them on Windows (platform-specific issue).
// We verify the exported routes array has the correct contract, then run the
// handlers directly through this thin harness.
// ---------------------------------------------------------------------------

function buildServer(routes: Route[]): http.Server {
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));
  return http.createServer(async (req, res) => {
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
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const servers: http.Server[] = [];

afterEach(async () => {
  for (const s of servers) {
    if (s.listening) await new Promise<void>((res) => s.close(() => res()));
  }
  servers.length = 0;
});

async function startWith(routes: Route[]): Promise<{ port: number }> {
  const server = buildServer(routes);
  servers.push(server);
  await new Promise<void>((res) => server.listen(0, res));
  return { port: (server.address() as { port: number }).port };
}

function getHttp(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('src/routes/status.ts — exports', () => {
  it('exports statusRouter as a function', async () => {
    const mod = await import('../src/routes/status.js');
    expect(typeof mod.statusRouter).toBe('function');
  });

  it('statusRouter() returns an array', async () => {
    const { statusRouter } = await import('../src/routes/status.js');
    const routes = statusRouter();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('default export is an array of routes', async () => {
    const mod = await import('../src/routes/status.js');
    expect(Array.isArray(mod.default)).toBe(true);
    expect((mod.default as Route[]).length).toBeGreaterThan(0);
  });

  it('route array includes GET /status', async () => {
    const mod = await import('../src/routes/status.js');
    const routes = mod.default as Route[];
    const statusRoute = routes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/status',
    );
    expect(statusRoute).toBeDefined();
    expect(typeof statusRoute!.handler).toBe('function');
  });
});

describe('GET /status — handler behaviour', () => {
  it('returns HTTP 200', async () => {
    const mod = await import('../src/routes/status.js');
    const { port } = await startWith(mod.default as Route[]);
    const { status } = await getHttp(`http://localhost:${port}/status`);
    expect(status).toBe(200);
  });

  it('response body has version, uptimeSeconds, brandColor', async () => {
    const mod = await import('../src/routes/status.js');
    const { port } = await startWith(mod.default as Route[]);
    const { body } = await getHttp(`http://localhost:${port}/status`);
    const json = body as Record<string, unknown>;
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('uptimeSeconds');
    expect(json).toHaveProperty('brandColor');
  });

  it('uptimeSeconds is a non-negative number', async () => {
    const mod = await import('../src/routes/status.js');
    const { port } = await startWith(mod.default as Route[]);
    const { body } = await getHttp(`http://localhost:${port}/status`);
    const json = body as Record<string, unknown>;
    expect(typeof json.uptimeSeconds).toBe('number');
    expect(json.uptimeSeconds as number).toBeGreaterThanOrEqual(0);
  });

  it('response Content-Type is application/json', async () => {
    const mod = await import('../src/routes/status.js');
    const { port } = await startWith(mod.default as Route[]);
    const { headers } = await getHttp(`http://localhost:${port}/status`);
    expect(headers['content-type']).toContain('application/json');
  });

  it('unknown path returns 404', async () => {
    const mod = await import('../src/routes/status.js');
    const { port } = await startWith(mod.default as Route[]);
    const { status } = await getHttp(`http://localhost:${port}/not-status`);
    expect(status).toBe(404);
  });
});
