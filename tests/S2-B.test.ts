/**
 * S2-B independent test — list routes
 * Exercises GET /lists and POST /lists via real HTTP.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse as NodeServerResponse } from 'node:http';
import { createServer } from '../src/server/app.ts';
import { listsRouter, resetLists } from '../src/routes/lists.ts';
import { clearRoutes } from '../src/routes/index.ts';

// ---------------------------------------------------------------------------
// Minimal HTTP test harness
// ---------------------------------------------------------------------------

interface TestServer {
  url: string;
  close(): Promise<void>;
}

async function startTestServer(routes = listsRouter()): Promise<TestServer> {
  const app = createServer({ routes });

  const server = httpCreateServer(async (nodeReq: IncomingMessage, nodeRes: NodeServerResponse) => {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      nodeReq.on('data', (chunk: Buffer) => chunks.push(chunk));
      nodeReq.on('end', resolve);
      nodeReq.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks).toString();
    let body: unknown;
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch { body = rawBody; }
    }

    const req = {
      method: nodeReq.method ?? 'GET',
      url: nodeReq.url ?? '/',
      headers: nodeReq.headers as Record<string, string | string[] | undefined>,
      body,
    };

    const res = {
      statusCode: 200,
      setHeader(name: string, value: string) { nodeRes.setHeader(name, value); },
      end(data?: string) { nodeRes.statusCode = this.statusCode; nodeRes.end(data ?? ''); },
    };

    await app.handle(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Bad address');
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let ts: TestServer;

beforeEach(async () => {
  clearRoutes();
  resetLists();
  ts = await startTestServer();
});

afterAll(async () => {
  await ts?.close();
});

// Helper
async function jsonFetch(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// listsRouter() export shape
// ---------------------------------------------------------------------------

describe('listsRouter() export', () => {
  it('is a function', () => {
    expect(typeof listsRouter).toBe('function');
  });

  it('returns an array', () => {
    const routes = listsRouter();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('returns routes including GET /lists', () => {
    const routes = listsRouter();
    const has = routes.some(r => r.method === 'GET' && r.path === '/lists');
    expect(has).toBe(true);
  });

  it('returns routes including POST /lists', () => {
    const routes = listsRouter();
    const has = routes.some(r => r.method === 'POST' && r.path === '/lists');
    expect(has).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /lists
// ---------------------------------------------------------------------------

describe('GET /lists', () => {
  it('returns 200', async () => {
    const { status } = await jsonFetch(`${ts.url}/lists`);
    expect(status).toBe(200);
  });

  it('returns an array when no lists exist', async () => {
    const { body } = await jsonFetch(`${ts.url}/lists`);
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns empty array initially', async () => {
    const { body } = await jsonFetch(`${ts.url}/lists`);
    expect(body).toHaveLength(0);
  });

  it('returns created lists', async () => {
    await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Shopping' }),
    });
    const { body } = await jsonFetch(`${ts.url}/lists`);
    expect((body as unknown[]).length).toBe(1);
  });

  it('returned list items have id and name', async () => {
    await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Work' }),
    });
    const { body } = await jsonFetch(`${ts.url}/lists`);
    const [list] = body as Array<{ id: number; name: string }>;
    expect(list).toHaveProperty('id');
    expect(list).toHaveProperty('name');
    expect(list.name).toBe('Work');
  });
});

// ---------------------------------------------------------------------------
// POST /lists
// ---------------------------------------------------------------------------

describe('POST /lists', () => {
  it('returns 201', async () => {
    const { status } = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Groceries' }),
    });
    expect(status).toBe(201);
  });

  it('returns the created list', async () => {
    const { body } = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Groceries' }),
    });
    const list = body as { id: number; name: string };
    expect(list.name).toBe('Groceries');
    expect(typeof list.id).toBe('number');
  });

  it('assigns incrementing ids', async () => {
    const r1 = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'First' }),
    });
    const r2 = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Second' }),
    });
    const l1 = r1.body as { id: number };
    const l2 = r2.body as { id: number };
    expect(l2.id).toBeGreaterThan(l1.id);
  });

  it('returns 400 when name is missing', async () => {
    const { status } = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });

  it('returns 400 when name is empty string', async () => {
    const { status } = await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });
    expect(status).toBe(400);
  });

  it('persists the list so GET /lists returns it', async () => {
    await jsonFetch(`${ts.url}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Persistent' }),
    });
    const { body } = await jsonFetch(`${ts.url}/lists`);
    const names = (body as Array<{ name: string }>).map(l => l.name);
    expect(names).toContain('Persistent');
  });
});
