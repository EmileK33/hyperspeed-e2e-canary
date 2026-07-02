/**
 * Phase-0 integration smoke test.
 *
 * Phase-safe contract:
 *  - Runs after every wave, including Wave 1 before any feature route exists.
 *  - Verifies the harness itself (server boot, ephemeral port, 404 shape,
 *    fixture helpers) — NOT the full feature endpoint surface.
 *  - Feature-route probes (GET /health, GET /status, etc.) belong to the
 *    terminal boot-and-hit gate (bootGate) that fires only once all route
 *    sessions have merged.
 *
 * Every assertion here must remain green with zero feature routes loaded.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, request } from './fixtures.js';
import type { ServerHandle } from './fixtures.js';

// ─── Server lifecycle ─────────────────────────────────────────────────────────

describe('integration harness — server lifecycle', () => {
  let handle: ServerHandle;

  beforeAll(async () => {
    handle = await startServer();
  });

  afterAll(async () => {
    await stopServer(handle);
  });

  it('starts on a dynamically-assigned ephemeral port (never 0)', () => {
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.port).toBeLessThanOrEqual(65535);
  });

  it('baseUrl uses 127.0.0.1 and the assigned port', () => {
    expect(handle.baseUrl).toBe(`http://127.0.0.1:${handle.port}`);
  });

  it('server object is an http.Server instance', () => {
    // Duck-type check: real http.Server has .listening after listen()
    expect(handle.server.listening).toBe(true);
  });
});

// ─── 404 / unknown-route contract ────────────────────────────────────────────

describe('integration harness — route dispatch', () => {
  let handle: ServerHandle;

  beforeAll(async () => {
    handle = await startServer();
  });

  afterAll(async () => {
    await stopServer(handle);
  });

  it('unknown GET route returns 404', async () => {
    const res = await request(handle, 'GET', '/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('404 response body is JSON with an "error" field', async () => {
    const res = await request(handle, 'GET', '/no-such-path');
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('404 response Content-Type is application/json', async () => {
    const res = await request(handle, 'GET', '/not-a-route');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('unknown POST route returns 404', async () => {
    const res = await request(handle, 'POST', '/no-such-post-route', { x: 1 });
    expect(res.status).toBe(404);
  });
});

// ─── Fixture helper API ───────────────────────────────────────────────────────

describe('integration harness — fixture helpers', () => {
  it('startServer / stopServer can be called multiple times independently', async () => {
    const h1 = await startServer();
    const h2 = await startServer();

    // Each server gets its own unique port
    expect(h1.port).not.toBe(h2.port);
    expect(h1.port).toBeGreaterThan(0);
    expect(h2.port).toBeGreaterThan(0);

    await stopServer(h1);
    await stopServer(h2);
  });

  it('server is no longer listening after stopServer', async () => {
    const h = await startServer();
    expect(h.server.listening).toBe(true);
    await stopServer(h);
    expect(h.server.listening).toBe(false);
  });

  it('request() returns status, body, and headers', async () => {
    const h = await startServer();
    try {
      const res = await request(h, 'GET', '/probe');
      expect(typeof res.status).toBe('number');
      expect(res.body).toBeDefined();
      expect(typeof res.headers).toBe('object');
    } finally {
      await stopServer(h);
    }
  });
});

// ─── Scaffold compile check ───────────────────────────────────────────────────

describe('integration harness — TypeScript scaffold', () => {
  it('fixtures module exports the required symbols', async () => {
    const mod = await import('./fixtures.js');
    expect(typeof mod.startServer).toBe('function');
    expect(typeof mod.stopServer).toBe('function');
    expect(typeof mod.request).toBe('function');
  });

  it('setup module re-exports fixture symbols', async () => {
    const mod = await import('./setup.js');
    expect(typeof mod.startServer).toBe('function');
    expect(typeof mod.stopServer).toBe('function');
    expect(typeof mod.request).toBe('function');
  });
});
