/**
 * S2-C independent test — status endpoint (US-006)
 *
 * Exercises `GET /status` via the real node:http server spun up from
 * `src/server/app.ts` (which re-exports `createServer` from `src/app.ts`).
 *
 * Importing `../src/routes/status.ts` is enough to register the route as a
 * side-effect; we then create a server and hit the endpoint over HTTP.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes } from '../src/routes/index.ts';

// Import the route module — side-effect registers the /status route.
import { statusRouter } from '../src/routes/status.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('src/routes/status.ts — export contract', () => {
  it('exports statusRouter as a function', () => {
    expect(typeof statusRouter).toBe('function');
  });

  it('statusRouter() returns a non-empty array', () => {
    const routes = statusRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('statusRouter() includes a GET /status route', () => {
    const routes = statusRouter();
    const route = routes.find(
      (r) => r.method.toUpperCase() === 'GET' && r.path === '/status',
    );
    expect(route).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HTTP integration — GET /status
// ---------------------------------------------------------------------------

describe('GET /status — HTTP integration', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    // Routes were already registered by the side-effect import above.
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  it('returns HTTP 200', async () => {
    const res = await fetch(`${url}/status`);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type: application/json', async () => {
    const res = await fetch(`${url}/status`);
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('returns a body with status: "ok"', async () => {
    const res = await fetch(`${url}/status`);
    const body = await res.json() as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
  });

  it('returns a body with a timestamp ISO string', async () => {
    const res = await fetch(`${url}/status`);
    const body = await res.json() as { status: string; timestamp: string };
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
    // Confirm it is a valid ISO date
    expect(isNaN(new Date(body.timestamp).getTime())).toBe(false);
  });

  it('does not return 404 for GET /status', async () => {
    const res = await fetch(`${url}/status`);
    expect(res.status).not.toBe(404);
  });
});
