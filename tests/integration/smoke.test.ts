/**
 * tests/integration/smoke.test.ts
 *
 * Phase-0 integration harness smoke tests.
 *
 * PHASE-SAFE CONTRACT
 * -------------------
 * This suite runs after EVERY wave (including integration-0 before any feature
 * routes exist). Tests MUST:
 *   - Pass with zero feature routes mounted.
 *   - Use an ephemeral port (listen(0)) — never a hard-coded port.
 *   - Not assume any specific application route is present.
 *
 * Tests that require Postgres are skipped automatically when DATABASE_URL is
 * absent (e.g. in the Phase-0 worktree environment without a DB service).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, jsonRequest, hasDatabase, bootstrapSchema } from './setup.js';
import type { TestServer } from './fixtures.js';

// ---------------------------------------------------------------------------
// Harness self-test
// ---------------------------------------------------------------------------

describe('harness self-test', () => {
  it('basic arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });

  it('hasDatabase() returns a boolean', () => {
    expect(typeof hasDatabase()).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Application server boot
// ---------------------------------------------------------------------------

describe('application server boot', () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startTestServer();
  });

  afterAll(async () => {
    if (srv) await srv.close();
  });

  it('starts on an ephemeral port (not 0, not 8787)', () => {
    expect(srv.port).toBeGreaterThan(0);
    expect(srv.port).not.toBe(8787);
  });

  it('baseUrl reflects the bound port', () => {
    expect(srv.baseUrl).toBe(`http://localhost:${srv.port}`);
  });

  it('responds to unknown routes with 404 JSON', async () => {
    const { status, body } = await jsonRequest(srv.baseUrl, 'GET', '/no-such-route');
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it('server.server is a node:http.Server', async () => {
    // Importing http just to check instanceof is heavy; duck-type instead.
    expect(typeof srv.server.listen).toBe('function');
    expect(typeof srv.server.close).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// jsonRequest helper
// ---------------------------------------------------------------------------

describe('jsonRequest helper', () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startTestServer();
  });

  afterAll(async () => {
    if (srv) await srv.close();
  });

  it('returns { status, body } for a GET request', async () => {
    const result = await jsonRequest(srv.baseUrl, 'GET', '/probe-helper');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('body');
  });

  it('sends a JSON body on POST', async () => {
    // No POST route is mounted yet — we just verify the helper does not throw.
    const result = await jsonRequest(srv.baseUrl, 'POST', '/probe-post', { title: 'test' });
    expect(typeof result.status).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Database connectivity (skipped when DATABASE_URL is absent)
// ---------------------------------------------------------------------------

describe('database connectivity', () => {
  it.skipIf(!hasDatabase())('bootstrapSchema() runs without error', async () => {
    await expect(bootstrapSchema()).resolves.not.toThrow();
  });

  it.skipIf(!hasDatabase())('withDbClient executes a simple query', async () => {
    const { withDbClient } = await import('./fixtures.js');
    const result = await withDbClient(async (client) => {
      const res = await client.query('SELECT 1 AS val');
      return res.rows[0].val;
    });
    expect(result).toBe(1);
  });
});
