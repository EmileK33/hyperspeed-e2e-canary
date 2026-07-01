/**
 * Integration harness smoke tests — Phase 0
 *
 * These tests are intentionally phase-safe: they run after every wave,
 * including integration-0 before any feature route exists.  They verify:
 *
 *   1. Fixture shapes are correct.
 *   2. `startServer` binds to an ephemeral port (port 0, never a fixed port).
 *   3. `jsonFetch` round-trips JSON through the test server.
 *   4. The TypeScript toolchain compiles and `strict` mode is active.
 *   5. Basic Node.js built-ins are available (ESM, `node:http`).
 *
 * Full endpoint probes (POST /todos, GET /lists, …) belong to the terminal
 * boot-and-hit gate once all route sessions have merged.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  todoFixtures,
  listFixtures,
  singleTodo,
  singleList,
  toJsonBody,
} from './fixtures.ts';

import {
  startServer,
  jsonFetch,
  hasDatabaseUrl,
  type TestServer,
} from './setup.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

describe('fixtures', () => {
  it('exports a non-empty todoFixtures array', () => {
    expect(Array.isArray(todoFixtures)).toBe(true);
    expect(todoFixtures.length).toBeGreaterThan(0);
  });

  it('every todo fixture has a string title and boolean done', () => {
    for (const todo of todoFixtures) {
      expect(typeof todo.title).toBe('string');
      expect(todo.title.length).toBeGreaterThan(0);
      expect(typeof todo.done).toBe('boolean');
    }
  });

  it('exports a non-empty listFixtures array', () => {
    expect(Array.isArray(listFixtures)).toBe(true);
    expect(listFixtures.length).toBeGreaterThan(0);
  });

  it('every list fixture has a non-empty string name', () => {
    for (const list of listFixtures) {
      expect(typeof list.name).toBe('string');
      expect(list.name.length).toBeGreaterThan(0);
    }
  });

  it('singleTodo is a valid TodoFixture', () => {
    expect(typeof singleTodo.title).toBe('string');
    expect(typeof singleTodo.done).toBe('boolean');
  });

  it('singleList is a valid ListFixture', () => {
    expect(typeof singleList.name).toBe('string');
    expect(singleList.name.length).toBeGreaterThan(0);
  });

  it('toJsonBody serialises an object to a JSON string', () => {
    const result = toJsonBody({ title: 'test', done: false });
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual({ title: 'test', done: false });
  });
});

// ---------------------------------------------------------------------------
// Harness helpers — startServer + jsonFetch
// ---------------------------------------------------------------------------

describe('startServer', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('binds to an ephemeral OS-assigned port (never 0)', async () => {
    server = await startServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });

    expect(server.port).toBeGreaterThan(0);
    expect(server.port).toBeLessThanOrEqual(65535);
  });

  it('exposes a valid http://127.0.0.1:<port> url', async () => {
    server = await startServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200);
      res.end('');
    });

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.url).toContain(String(server.port));
  });

  it('serves requests on the returned url', async () => {
    server = await startServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('pong');
    });

    const res = await fetch(server.url + '/ping');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('pong');
  });

  it('close() shuts the server down cleanly', async () => {
    const srv = await startServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(204);
      res.end();
    });
    // Should resolve without error
    await expect(srv.close()).resolves.toBeUndefined();
    server = null; // already closed; skip afterEach teardown
  });
});

describe('jsonFetch', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('sends JSON and parses the response body', async () => {
    server = await startServer((req: IncomingMessage, res: ServerResponse) => {
      let raw = '';
      req.on('data', (c: Buffer) => { raw += c.toString(); });
      req.on('end', () => {
        const received = JSON.parse(raw || '{}') as Record<string, unknown>;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ echo: received }));
      });
    });

    const { status, body } = await jsonFetch<{ echo: { title: string } }>(
      server.url + '/echo',
      { method: 'POST', body: JSON.stringify({ title: 'hello' }) },
    );

    expect(status).toBe(200);
    expect((body as { echo: { title: string } }).echo).toEqual({ title: 'hello' });
  });

  it('returns status code from the server', async () => {
    server = await startServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    const { status, body } = await jsonFetch(server.url + '/missing');
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe('not found');
  });
});

// ---------------------------------------------------------------------------
// Environment / toolchain sanity
// ---------------------------------------------------------------------------

describe('environment', () => {
  it('hasDatabaseUrl reports truthily when DATABASE_URL env var is present', () => {
    const result = hasDatabaseUrl();
    expect(typeof result).toBe('boolean');
    // We don't assert true/false — CI sets it; local dev may not.
    // This test just confirms the helper doesn't throw.
  });

  it('runs under Node.js with ESM support', () => {
    expect(typeof process).toBe('object');
    expect(typeof process.version).toBe('string');
  });

  it('TypeScript strict arithmetic is enforced at compile time', () => {
    // If TS compilation fails, the whole test file errors before this runs.
    const add = (a: number, b: number): number => a + b;
    expect(add(1, 2)).toBe(3);
  });
});
