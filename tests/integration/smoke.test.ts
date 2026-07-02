/**
 * Integration harness smoke tests — Phase 0.
 *
 * Phase-safe: runs after every wave (including integration-0, before any
 * feature routes exist).  Tests app boot, ephemeral-port binding, basic HTTP
 * dispatch, and fixture helpers.  Does NOT probe the full future endpoint
 * surface — that belongs to the terminal boot-and-hit gate.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type http from 'node:http';
import {
  startTestServer,
  stopTestServer,
  get,
  post,
  patch,
  del,
  jsonRequest,
  type TestServer,
} from './fixtures.js';

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let ts: TestServer;

beforeAll(async () => {
  ts = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(ts.server);
});

// ─── Boot & port ──────────────────────────────────────────────────────────────

describe('server boot', () => {
  it('binds to an ephemeral port (not a fixed fallback)', () => {
    expect(ts.port).toBeGreaterThan(0);
    expect(ts.port).not.toBe(8787); // never the fixed fallback
    expect(ts.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('server.address() reflects the bound port', () => {
    const addr = ts.server.address() as { port: number };
    expect(addr.port).toBe(ts.port);
  });
});

// ─── HTTP dispatch ────────────────────────────────────────────────────────────

describe('HTTP dispatch — pre-feature-routes', () => {
  it('GET unknown path → 404 JSON', async () => {
    const { status, data } = await get(ts.baseUrl, '/nonexistent');
    expect(status).toBe(404);
    expect(data).toMatchObject({ error: expect.any(String) });
  });

  it('POST unknown path → 404 JSON', async () => {
    const { status, data } = await post(ts.baseUrl, '/nonexistent', { x: 1 });
    expect(status).toBe(404);
    expect(data).toMatchObject({ error: expect.any(String) });
  });

  it('PATCH unknown path → 404 JSON', async () => {
    const { status, data } = await patch(ts.baseUrl, '/nonexistent', {});
    expect(status).toBe(404);
  });

  it('DELETE unknown path → 404 JSON', async () => {
    const { status, data } = await del(ts.baseUrl, '/nonexistent');
    expect(status).toBe(404);
  });

  it('root path / → 404 JSON', async () => {
    const { status } = await get(ts.baseUrl, '/');
    expect(status).toBe(404);
  });

  it('response content-type is application/json', async () => {
    const { headers } = await get(ts.baseUrl, '/no-such-route');
    expect(headers['content-type']).toContain('application/json');
  });
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

describe('fixture helpers', () => {
  it('jsonRequest returns status + data', async () => {
    const result = await jsonRequest(ts.baseUrl, 'GET', '/anything');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('headers');
  });

  it('multiple independent servers can run concurrently', async () => {
    const ts2 = await startTestServer();
    try {
      expect(ts2.port).toBeGreaterThan(0);
      expect(ts2.port).not.toBe(ts.port); // OS assigns distinct ports
      const { status } = await get(ts2.baseUrl, '/test');
      expect(status).toBe(404);
    } finally {
      await stopTestServer(ts2.server);
    }
  });

  it('stopTestServer closes the server', async () => {
    const tmp = await startTestServer();
    await stopTestServer(tmp.server);
    // After close, address() returns null
    expect(tmp.server.address()).toBeNull();
  });
});

// ─── Boot-token probe (only active when HS_BOOT_TOKEN is set) ────────────────

describe('boot-token identity probe', () => {
  it('/__boot is unreachable without HS_BOOT_TOKEN env', async () => {
    // When the env var is absent the route does not exist → 404
    const orig = process.env.HS_BOOT_TOKEN;
    delete process.env.HS_BOOT_TOKEN;
    try {
      const { status } = await get(ts.baseUrl, '/__boot');
      expect(status).toBe(404);
    } finally {
      if (orig !== undefined) process.env.HS_BOOT_TOKEN = orig;
    }
  });
});
