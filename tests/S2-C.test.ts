/**
 * S2-C independent tests — Status route (US-006)
 *
 * Verifies:
 *   AC-1: GET /status returns 200 with { version, uptimeSeconds }
 *   AC-2: response includes brandColor '#3a86ff'
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
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
        const addr = (
          server as unknown as { address(): { port: number } | null }
        ).address?.() ?? null;
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
// Suite setup
// ---------------------------------------------------------------------------

let bound: BoundServer;

beforeAll(async () => {
  // Clear existing routes, then import the status route module (self-registers)
  clearRoutes();
  await import('../src/routes/status.ts');
  bound = await startServer();
});

afterAll(async () => {
  if (bound) {
    await stopServer(bound.server);
  }
  clearRoutes();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('US-006 — GET /status', () => {
  it('returns 200', async () => {
    const res = await fetch(`${bound.baseUrl}/status`);
    expect(res.status).toBe(200);
  });

  it('responds with Content-Type application/json', async () => {
    const res = await fetch(`${bound.baseUrl}/status`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('AC-1: body contains version and uptimeSeconds', async () => {
    const res = await fetch(`${bound.baseUrl}/status`);
    const body = await res.json() as { version: string; uptimeSeconds: number; brandColor: string };
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('AC-2: body contains brandColor #3a86ff', async () => {
    const res = await fetch(`${bound.baseUrl}/status`);
    const body = await res.json() as { brandColor: string };
    expect(body.brandColor).toBe('#3a86ff');
  });

  it('non-existent method returns 404', async () => {
    const res = await fetch(`${bound.baseUrl}/status`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('statusRouter export', () => {
  it('exports statusRouter as a function', async () => {
    const mod = await import('../src/routes/status.ts');
    expect(typeof mod.statusRouter).toBe('function');
  });

  it('default-exports a Route array', async () => {
    const mod = await import('../src/routes/status.ts');
    expect(Array.isArray(mod.default)).toBe(true);
    expect(mod.default.length).toBeGreaterThan(0);
    expect(typeof mod.default[0].method).toBe('string');
    expect(typeof mod.default[0].path).toBe('string');
    expect(typeof mod.default[0].handler).toBe('function');
  });
});
