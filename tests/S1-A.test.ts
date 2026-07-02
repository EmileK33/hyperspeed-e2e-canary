/**
 * S1-A independent tests — HTTP server bootstrap (US-002)
 *
 * Verifies:
 *   AC-1: createServer() returns a configured app with JSON body parsing.
 *   AC-2: An unknown route returns 404 with a JSON error body.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes, registerRoutes } from '../src/routes/index.ts';
import type { Route } from '../src/http.ts';
import type { AppRequest, AppResponse } from '../src/types/contracts.ts';

// ---------------------------------------------------------------------------
// Helpers — spin up a real node:http server on an ephemeral port
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
    // Port 0 lets the OS pick a free port
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
// Test suite
// ---------------------------------------------------------------------------

let bound: BoundServer | null = null;

afterEach(async () => {
  if (bound) {
    await stopServer(bound.server);
    bound = null;
  }
  clearRoutes();
});

describe('src/server/app.ts — createServer export', () => {
  it('exports createServer as a function', async () => {
    const { createServer: cs } = await import('../src/server/app.ts');
    expect(typeof cs).toBe('function');
  });

  it('createServer() resolves to a server object with listen + on', async () => {
    const server = await createServer();
    expect(typeof (server as unknown as { listen: unknown }).listen).toBe('function');
    expect(typeof (server as unknown as { on: unknown }).on).toBe('function');
    await stopServer(server);
  });
});

describe('US-002 AC-2 — unknown route returns 404 with JSON error', () => {
  it('returns 404 and { error: "Route not found" } for an unregistered path', async () => {
    clearRoutes();
    bound = await startServer();

    const res = await fetch(`${bound.baseUrl}/does-not-exist`);
    expect(res.status).toBe(404);

    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/route not found/i);
  });
});

describe('US-002 AC-1 — JSON body parsing', () => {
  it('parses a JSON request body and makes it available to a route handler', async () => {
    clearRoutes();

    // Register a test echo route
    let receivedBody: unknown = undefined;
    const echoRoute: Route = {
      method: 'POST',
      path: '/echo',
      handler: async (req: AppRequest, res: AppResponse) => {
        receivedBody = req.body;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ received: req.body }));
      },
    };
    registerRoutes([echoRoute]);

    bound = await startServer();

    const payload = { title: 'test todo', done: false };
    const res = await fetch(`${bound.baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { received: typeof payload };
    expect(json.received).toEqual(payload);
    expect(receivedBody).toEqual(payload);
  });

  it('handles requests with no body (body is null)', async () => {
    clearRoutes();

    let receivedBody: unknown = 'sentinel';
    const route: Route = {
      method: 'GET',
      path: '/probe',
      handler: async (req: AppRequest, res: AppResponse) => {
        receivedBody = req.body;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      },
    };
    registerRoutes([route]);

    bound = await startServer();

    const res = await fetch(`${bound.baseUrl}/probe`);
    expect(res.status).toBe(200);
    // Empty body → parseJsonBody returns null
    expect(receivedBody).toBeNull();
  });
});
