/**
 * S1-A independent test — HTTP server bootstrap (US-002)
 *
 * Exercises `createServer` exported from `src/server/app.ts`.
 *
 * All tests are self-contained: they spin up a real node:http server on an
 * ephemeral port and make requests using the built-in `fetch` API (Node 18+).
 * No external DB is required — routes are cleared before each suite so the
 * only responses are from the catch-all 404 handler or from routes registered
 * within the test itself.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { registerRoutes, clearRoutes } from '../src/routes/index.ts';
import { sendJson } from '../src/http.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Spin up a server on a random port, return { url, close }. */
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

describe('src/server/app.ts — export contract', () => {
  it('exports createServer as a function', () => {
    expect(typeof createServer).toBe('function');
  });

  it('createServer() returns a Promise', () => {
    const result = createServer();
    expect(result).toBeInstanceOf(Promise);
    // Clean up by consuming the promise (the server is not started here)
    return result.then((srv) => {
      expect(typeof (srv as unknown as { listen: unknown }).listen).toBe('function');
    });
  });
});

// ---------------------------------------------------------------------------
// US-002 AC-1: JSON body parsing enabled
// ---------------------------------------------------------------------------

describe('US-002 AC-1 — JSON body parsing', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    clearRoutes();
    // Register an echo route that reads the parsed body
    registerRoutes([
      {
        method: 'POST',
        path: '/echo',
        handler: async (req, res, _params) => {
          sendJson(res, 200, { received: req.body });
        },
      },
    ]);
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  it('parses a JSON request body and makes it available to the handler', async () => {
    const response = await fetch(`${url}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    expect(response.status).toBe(200);
    const json = await response.json() as { received: { hello: string } };
    expect(json.received).toEqual({ hello: 'world' });
  });

  it('handles a request with no body (body is null)', async () => {
    const response = await fetch(`${url}/echo`, {
      method: 'POST',
    });
    expect(response.status).toBe(200);
    const json = await response.json() as { received: unknown };
    expect(json.received).toBeNull();
  });

  it('sets Content-Type: application/json on responses', async () => {
    const response = await fetch(`${url}/echo`, {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
    });
    expect(response.headers.get('content-type')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// US-002 AC-2: Unknown route returns 404 with JSON error body
// ---------------------------------------------------------------------------

describe('US-002 AC-2 — 404 catch-all', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    clearRoutes(); // no routes registered — every path should 404
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  it('returns HTTP 404 for an unmatched GET route', async () => {
    const response = await fetch(`${url}/not-found`);
    expect(response.status).toBe(404);
  });

  it('returns a JSON body with an "error" field for an unknown route', async () => {
    const response = await fetch(`${url}/unknown/path`);
    const body = await response.json() as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('returns 404 for POST to an unregistered route', async () => {
    const response = await fetch(`${url}/missing`, { method: 'POST', body: '{}' });
    expect(response.status).toBe(404);
  });

  it('Content-Type of the 404 response is application/json', async () => {
    const response = await fetch(`${url}/gone`);
    expect(response.headers.get('content-type')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Route dispatch: registered routes are served correctly
// ---------------------------------------------------------------------------

describe('route dispatch — registered routes are reachable', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    clearRoutes();
    registerRoutes([
      {
        method: 'GET',
        path: '/ping',
        handler: async (_req, res, _params) => {
          sendJson(res, 200, { pong: true });
        },
      },
      {
        method: 'GET',
        path: '/items/:id',
        handler: async (_req, res, params) => {
          sendJson(res, 200, { id: params.id });
        },
      },
    ]);
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  it('dispatches GET /ping to the registered handler', async () => {
    const response = await fetch(`${url}/ping`);
    expect(response.status).toBe(200);
    const body = await response.json() as { pong: boolean };
    expect(body.pong).toBe(true);
  });

  it('captures route params and passes them to the handler', async () => {
    const response = await fetch(`${url}/items/42`);
    expect(response.status).toBe(200);
    const body = await response.json() as { id: string };
    expect(body.id).toBe('42');
  });

  it('still 404s for a path that has no registered handler', async () => {
    const response = await fetch(`${url}/nope`);
    expect(response.status).toBe(404);
  });
});
