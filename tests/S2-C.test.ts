// Independent tests for S2-C: GET /status — src/routes/status.ts
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { compileRoute, matchPath, sendJson, type RouteRequest } from '../src/http.js';
import { statusRouter } from '../src/routes/status.js';
import routes, { statusRouter as statusRouterNamed } from '../src/routes/status.js';
import type { StatusBody } from '../src/types/contracts.js';

// Build a minimal test server that mounts the real routes from the module
// (createServer's auto-discovery via dynamic file:// import does not work in
// the vitest transform environment, so we mount the route array directly — this
// still exercises the real route definition, method, path, and handler).
async function startTestServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const compiled = routes.map((r) => ({ r, c: compileRoute(r.path) }));
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
  const close = () => new Promise<void>((ok, fail) => server.close((e?: Error) => (e ? fail(e) : ok())));
  return { port, close };
}

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

describe('src/routes/status — GET /status (US-006)', () => {
  it('statusRouter is exported as a function', () => {
    expect(typeof statusRouter).toBe('function');
  });

  it('default export is an array with a GET /status route', () => {
    expect(Array.isArray(routes)).toBe(true);
    const route = routes.find((r) => r.method.toUpperCase() === 'GET' && r.path === '/status');
    expect(route).toBeTruthy();
  });

  it('statusRouter() returns routes array with GET /status', () => {
    const r = statusRouterNamed();
    expect(Array.isArray(r)).toBe(true);
    const route = r.find((x) => x.method.toUpperCase() === 'GET' && x.path === '/status');
    expect(route).toBeTruthy();
  });

  it('GET /status returns 200 with correct StatusBody shape', async () => {
    const { port, close } = await startTestServer();
    const result = await get(port, '/status');
    await close();

    expect(result.status).toBe(200);
    const body = result.body as StatusBody;
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof body.brandColor).toBe('string');
    expect(body.brandColor).toMatch(/^#/);
  });

  it('GET /status version is non-empty', async () => {
    const { port, close } = await startTestServer();
    const result = await get(port, '/status');
    await close();

    const body = result.body as StatusBody;
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('unknown path returns 404', async () => {
    const { port, close } = await startTestServer();
    const result = await get(port, '/no-such-path');
    await close();

    expect(result.status).toBe(404);
  });
});
