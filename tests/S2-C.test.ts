/**
 * S2-C independent test — status route
 * Exercises src/routes/status.ts via a real HTTP server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Import our route module — this triggers registerRoutes() as a side-effect.
import statusRoutes, { statusRouter } from '../src/routes/status.ts';
import { createApp } from '../src/app.ts';
import { clearRoutes } from '../src/routes/index.ts';

// ---------------------------------------------------------------------------
// Test HTTP server wired to createApp()
// ---------------------------------------------------------------------------

interface TestHandle {
  url: string;
  close(): Promise<void>;
}

async function startTestServer(): Promise<TestHandle> {
  const app = createApp();

  const server = httpCreateServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    let body: unknown;
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        nodeReq.on('data', (chunk: Buffer) => chunks.push(chunk));
        nodeReq.on('end', resolve);
        nodeReq.on('error', reject);
      });
      const raw = Buffer.concat(chunks).toString();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = undefined;
    }

    const req = {
      method: nodeReq.method ?? 'GET',
      url: nodeReq.url ?? '/',
      headers: nodeReq.headers as Record<string, string | string[] | undefined>,
      body,
    };

    const res = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        nodeRes.setHeader(name, value);
      },
      end(data?: string) {
        nodeRes.statusCode = this.statusCode;
        nodeRes.end(data ?? '');
      },
    };

    await app.handle(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Unexpected address');
  const { port } = addr;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    close: () => new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('src/routes/status.ts — exports', () => {
  it('default export is a non-empty array', () => {
    expect(Array.isArray(statusRoutes)).toBe(true);
    expect(statusRoutes.length).toBeGreaterThan(0);
  });

  it('statusRouter is a function', () => {
    expect(typeof statusRouter).toBe('function');
  });

  it('statusRouter() returns the same routes array shape', () => {
    const routes = statusRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('route has method GET and path /status', () => {
    const route = statusRoutes.find(r => r.method === 'GET' && r.path === '/status');
    expect(route).toBeDefined();
  });
});

describe('GET /status — HTTP integration', () => {
  let handle: TestHandle;

  beforeAll(async () => {
    handle = await startTestServer();
  });

  afterAll(async () => {
    await handle.close();
    clearRoutes();
  });

  it('returns 200', async () => {
    const res = await fetch(`${handle.url}/status`);
    expect(res.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const res = await fetch(`${handle.url}/status`);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toContain('application/json');
  });

  it('body has status: "ok"', async () => {
    const res = await fetch(`${handle.url}/status`);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('body includes a timestamp string', async () => {
    const res = await fetch(`${handle.url}/status`);
    const body = await res.json() as { timestamp: string };
    expect(typeof body.timestamp).toBe('string');
    expect(body.timestamp.length).toBeGreaterThan(0);
  });

  it('timestamp is a valid ISO-8601 date', async () => {
    const res = await fetch(`${handle.url}/status`);
    const body = await res.json() as { timestamp: string };
    const d = new Date(body.timestamp);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('unknown route returns 404', async () => {
    const res = await fetch(`${handle.url}/not-a-real-route`);
    expect(res.status).toBe(404);
  });
});
