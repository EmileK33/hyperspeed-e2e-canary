/**
 * S2-A independent test — Health probe (US-005)
 *
 * Exercises GET /health via a real node:http server on an ephemeral port.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes } from '../src/routes/index.ts';

// Import the health route module to trigger self-registration.
import '../src/routes/health.ts';

async function startServer(): Promise<{ url: string; close: () => void }> {
  const server = await createServer();
  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, resolve);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address = (server as any).address();
  const port: number = address?.port ?? 0;
  const url = `http://localhost:${port}`;
  const close = () => {
    (server as unknown as { close(): void }).close();
  };
  return { url, close };
}

// ---------------------------------------------------------------------------
// Export contract
// ---------------------------------------------------------------------------

describe('src/routes/health.ts — export contract', () => {
  it('exports healthRouter as a function', async () => {
    const mod = await import('../src/routes/health.ts');
    expect(typeof mod.healthRouter).toBe('function');
  });

  it('healthRouter() returns a non-empty Route array', async () => {
    const mod = await import('../src/routes/health.ts');
    const routes = mod.healthRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// US-005 AC-1: GET /health returns 200 { status: "ok" }
// ---------------------------------------------------------------------------

describe('US-005 AC-1 — GET /health', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  it('returns HTTP 200', async () => {
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
  });

  it('returns { status: "ok" }', async () => {
    const response = await fetch(`${url}/health`);
    const body = await response.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('sets Content-Type: application/json', async () => {
    const response = await fetch(`${url}/health`);
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('returns 404 for an unrelated path', async () => {
    const response = await fetch(`${url}/not-health`);
    expect(response.status).toBe(404);
  });
});
