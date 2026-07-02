/**
 * S2-B independent tests — Lists routes (US-004)
 *
 * Spins up a real node:http server on an ephemeral port and exercises
 * GET /lists and POST /lists via HTTP fetch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes, registerRoutes } from '../src/routes/index.ts';
import { listsRouter, _resetLists } from '../src/routes/lists.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ServerHandle = Awaited<ReturnType<typeof createServer>>;

interface BoundServer {
  server: ServerHandle;
  baseUrl: string;
}

async function startServer(): Promise<BoundServer> {
  const server = await createServer();
  return new Promise((resolve, reject) => {
    (server as unknown as { listen(port: number, cb: () => void): void })
      .listen(0, () => {
        const addr = (server as unknown as { address(): { port: number } | null }).address?.() ?? null;
        const port = addr ? addr.port : 0;
        resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
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
// Suite setup — one server per describe, fresh store per test
// ---------------------------------------------------------------------------

let bound: BoundServer | null = null;

beforeEach(async () => {
  // Reset in-memory list store and route registry, then re-register lists routes
  _resetLists();
  clearRoutes();
  registerRoutes(listsRouter());
  bound = await startServer();
});

afterEach(async () => {
  if (bound) {
    await stopServer(bound.server);
    bound = null;
  }
  clearRoutes();
});

// ---------------------------------------------------------------------------
// GET /lists
// ---------------------------------------------------------------------------

describe('GET /lists', () => {
  it('returns 200 with an empty array when no lists exist', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 200 with all created lists', async () => {
    // Create two lists first
    await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Groceries' }),
    });
    await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Work' }),
    });

    const res = await fetch(`${bound!.baseUrl}/lists`);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: number; name: string }>;
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ name: 'Groceries' });
    expect(body[1]).toMatchObject({ name: 'Work' });
  });

  it('returns JSON content-type', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// POST /lists
// ---------------------------------------------------------------------------

describe('POST /lists', () => {
  it('creates a list and returns 201 with the created object', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shopping' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; name: string };
    expect(typeof body.id).toBe('number');
    expect(body.name).toBe('Shopping');
  });

  it('assigns incrementing ids to created lists', async () => {
    const res1 = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'First' }),
    });
    const res2 = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second' }),
    });
    const b1 = await res1.json() as { id: number };
    const b2 = await res2.json() as { id: number };
    expect(b2.id).toBeGreaterThan(b1.id);
  });

  it('returns 400 when name is missing', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when name is empty string', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('trims whitespace from the name', async () => {
    const res = await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Errands  ' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('Errands');
  });

  it('persists created lists so GET /lists returns them', async () => {
    await fetch(`${bound!.baseUrl}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Persisted' }),
    });
    const res = await fetch(`${bound!.baseUrl}/lists`);
    const body = await res.json() as Array<{ name: string }>;
    expect(body.some((l) => l.name === 'Persisted')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listsRouter export
// ---------------------------------------------------------------------------

describe('listsRouter export', () => {
  it('is a function', () => {
    expect(typeof listsRouter).toBe('function');
  });

  it('returns an array of Route objects', () => {
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('includes GET /lists and POST /lists routes', () => {
    const routes = listsRouter();
    const methods = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`);
    expect(methods).toContain('GET /lists');
    expect(methods).toContain('POST /lists');
  });
});
