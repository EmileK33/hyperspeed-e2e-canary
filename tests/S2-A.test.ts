/**
 * S2-A independent tests — Health endpoint (US-005)
 *
 * Verifies:
 *   GET /health → 200 { status: 'ok' }
 *   Other methods on /health → 404
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from '../src/app.ts';
import { clearRoutes } from '../src/routes/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ServerHandle = Awaited<ReturnType<typeof createServer>>;

interface BoundServer {
  server: ServerHandle;
  port: number;
  baseUrl: string;
}

async function startServer(): Promise<BoundServer> {
  const server = await createServer();
  return new Promise((resolve, reject) => {
    (server as unknown as { listen(port: number, cb: () => void): void })
      .listen(0, () => {
        const addr = (server as unknown as { address(): { port: number } | null }).address?.() ?? null;
        const port = addr ? addr.port : 0;
        resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
      });
    server.on('error', reject);
  });
}

async function stopServer(s: ServerHandle): Promise<void> {
  return new Promise((resolve) => {
    (s as unknown as { close(cb: () => void): void }).close(() => resolve());
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

let bound: BoundServer | null = null;

afterEach(async () => {
  if (bound) {
    await stopServer(bound.server);
    bound = null;
  }
  clearRoutes();
});

describe('src/routes/health.ts — healthRouter export', () => {
  it('exports healthRouter as a function', async () => {
    const { healthRouter } = await import('../src/routes/health.ts');
    expect(typeof healthRouter).toBe('function');
  });

  it('healthRouter() returns an array containing the GET /health route', async () => {
    clearRoutes();
    const { healthRouter } = await import('../src/routes/health.ts');
    const routes = healthRouter();
    expect(Array.isArray(routes)).toBe(true);
    const healthRoute = routes.find(r => r.method === 'GET' && r.path === '/health');
    expect(healthRoute).toBeDefined();
  });
});

describe('US-005 — GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    clearRoutes();
    // Module is cached after first import; call healthRouter() to re-register
    const { healthRouter } = await import('../src/routes/health.ts');
    healthRouter();

    bound = await startServer();

    const res = await fetch(`${bound.baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('returns JSON content-type', async () => {
    clearRoutes();
    const { healthRouter } = await import('../src/routes/health.ts');
    healthRouter();

    bound = await startServer();

    const res = await fetch(`${bound.baseUrl}/health`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('POST /health returns 404 (method not registered)', async () => {
    clearRoutes();
    const { healthRouter } = await import('../src/routes/health.ts');
    healthRouter();

    bound = await startServer();

    const res = await fetch(`${bound.baseUrl}/health`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
