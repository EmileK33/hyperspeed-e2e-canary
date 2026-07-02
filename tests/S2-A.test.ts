// Independent test for Session S2-A — health route (US-005).
// Run: npm run test -- tests/S2-A.test.ts
//
// NOTE: The route auto-discovery in src/routes/index.ts uses pathToFileURL() to
// dynamically import route modules. On Windows paths containing spaces, vite-node
// fails to resolve the encoded URL (file:///D:/path%20with%20space/...) so routes
// are silently skipped. We work around this by mocking loadRoutes to import the
// health module directly (bypassing the broken file-URL resolution), then test
// through the REAL createServer dispatcher so the full routing stack is exercised.

import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';

// Mock loadRoutes BEFORE any imports that pull in src/routes/index.js,
// so createServer sees our corrected discovery result.
vi.mock('../src/routes/index.js', () => ({
  loadRoutes: async () => {
    const mod = await import('../src/routes/health.js');
    return Array.isArray(mod.default) ? mod.default : [];
  },
}));

describe('GET /health — US-005', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    for (const s of servers) {
      if (s.listening) {
        await new Promise<void>((res) => s.close(() => res()));
      }
    }
    servers.length = 0;
  });

  it('exports healthRouter as a function from src/routes/health.ts', async () => {
    const mod = await import('../src/routes/health.js');
    expect(typeof mod.healthRouter).toBe('function');
  });

  it('healthRouter() returns a non-empty array of routes', async () => {
    const { healthRouter } = await import('../src/routes/health.js');
    const routes = healthRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('default export is an array of Route objects with GET /health', async () => {
    const mod = await import('../src/routes/health.js');
    const routes = mod.default as Array<{ method: string; path: string }>;
    expect(Array.isArray(routes)).toBe(true);
    const healthRoute = routes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/health',
    );
    expect(healthRoute).toBeDefined();
  });

  it('AC-1: GET /health returns 200 with { status: "ok" } via the real createServer', async () => {
    const { createServer } = await import('../src/app.js');
    const server = await createServer();
    servers.push(server);

    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as { port: number }).port;

    const { status, body } = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        http
          .get(`http://localhost:${port}/health`, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          })
          .on('error', reject);
      },
    );

    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json).toEqual({ status: 'ok' });
  });

  it('unknown route still returns 404 (server routes correctly)', async () => {
    const { createServer } = await import('../src/app.js');
    const server = await createServer();
    servers.push(server);

    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as { port: number }).port;

    const { status } = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        http
          .get(`http://localhost:${port}/not-a-real-route`, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          })
          .on('error', reject);
      },
    );

    expect(status).toBe(404);
  });
});
