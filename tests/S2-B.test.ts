/**
 * S2-B independent test — lists routes (US-004)
 *
 * Spins up the real server (src/app.ts / src/server/app.ts) on an ephemeral
 * port and exercises GET /lists and POST /lists via fetch.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes, registerRoutes } from '../src/routes/index.ts';
import listsRoutes, { _resetLists } from '../src/routes/lists.ts';

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

describe('src/routes/lists.ts — export contract', () => {
  it('default-exports an array of routes', async () => {
    const mod = await import('../src/routes/lists.ts');
    expect(Array.isArray(mod.default)).toBe(true);
    expect(mod.default.length).toBeGreaterThan(0);
  });

  it('exports listsRouter as a function', async () => {
    const { listsRouter } = await import('../src/routes/lists.ts');
    expect(typeof listsRouter).toBe('function');
  });

  it('listsRouter() returns an array of routes', async () => {
    const { listsRouter } = await import('../src/routes/lists.ts');
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-004 — GET /lists and POST /lists
// ---------------------------------------------------------------------------

describe('US-004 — lists endpoints', () => {
  let url: string;
  let close: () => void;

  beforeAll(async () => {
    clearRoutes();
    registerRoutes(listsRoutes);
    ({ url, close } = await startServer());
  });

  afterAll(() => {
    close();
    clearRoutes();
  });

  beforeEach(() => {
    _resetLists();
  });

  // ---- GET /lists ----

  it('GET /lists returns 200', async () => {
    const res = await fetch(`${url}/lists`);
    expect(res.status).toBe(200);
  });

  it('GET /lists returns JSON content-type', async () => {
    const res = await fetch(`${url}/lists`);
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('GET /lists returns an empty array initially', async () => {
    const res = await fetch(`${url}/lists`);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('GET /lists returns all created lists', async () => {
    await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Work' }),
    });
    await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Personal' }),
    });

    const res = await fetch(`${url}/lists`);
    const body = await res.json() as Array<{ id: number; name: string }>;
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Work');
    expect(body[1].name).toBe('Personal');
  });

  // ---- POST /lists ----

  it('POST /lists returns 201', async () => {
    const res = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shopping' }),
    });
    expect(res.status).toBe(201);
  });

  it('POST /lists returns JSON content-type', async () => {
    const res = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shopping' }),
    });
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('POST /lists returns the created list with id and name', async () => {
    const res = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Groceries' }),
    });
    const body = await res.json() as { id: number; name: string };
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
    expect(body.name).toBe('Groceries');
  });

  it('POST /lists assigns incrementing ids', async () => {
    const r1 = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'First' }),
    });
    const r2 = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second' }),
    });
    const b1 = await r1.json() as { id: number };
    const b2 = await r2.json() as { id: number };
    expect(b2.id).toBeGreaterThan(b1.id);
  });

  it('POST /lists without a name returns 400', async () => {
    const res = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /lists with an empty name returns 400', async () => {
    const res = await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('created list appears in subsequent GET /lists', async () => {
    await fetch(`${url}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New List' }),
    });
    const res = await fetch(`${url}/lists`);
    const body = await res.json() as Array<{ name: string }>;
    expect(body.some((l) => l.name === 'New List')).toBe(true);
  });
});
