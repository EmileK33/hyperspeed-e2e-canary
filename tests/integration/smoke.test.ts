/**
 * Integration harness smoke tests — Phase 0.
 *
 * Phase-safe: must pass at EVERY integration wave (W1–W7), including
 * integration-0 before any feature routes or stores have merged.
 *
 * Rules:
 *  - Do NOT import from src/ modules that do not yet exist.
 *  - Do NOT probe endpoints from the spec or the bootGate.
 *  - Use ephemeral ports (never a hardcoded port like 8787).
 */

import { describe, it, expect } from 'vitest';
import {
  hasDatabaseUrl,
  sampleTodo,
  sampleList,
  testBaseUrl,
  startEphemeralServer,
  postJson,
  getJson,
} from './fixtures.ts';

// ---------------------------------------------------------------------------
// Sanity
// ---------------------------------------------------------------------------

describe('harness sanity', () => {
  it('vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });

  it('Node built-in fetch is available (Node 18+)', () => {
    expect(typeof fetch).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Fixtures module
// ---------------------------------------------------------------------------

describe('fixtures module', () => {
  it('exports hasDatabaseUrl()', () => {
    expect(typeof hasDatabaseUrl).toBe('function');
    expect(typeof hasDatabaseUrl()).toBe('boolean');
  });

  it('exports sampleTodo with expected shape', () => {
    expect(sampleTodo).toMatchObject({ title: expect.any(String), completed: false });
  });

  it('exports sampleList with expected shape', () => {
    expect(sampleList).toMatchObject({ name: expect.any(String) });
  });

  it('testBaseUrl produces a well-formed URL', () => {
    const url = testBaseUrl(3000);
    expect(url).toBe('http://127.0.0.1:3000');
    expect(() => new URL(url)).not.toThrow();
  });

  it('exports postJson and getJson helpers', () => {
    expect(typeof postJson).toBe('function');
    expect(typeof getJson).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Ephemeral server helper
// ---------------------------------------------------------------------------

describe('startEphemeralServer', () => {
  it('binds to a random port (never 0) and responds', async () => {
    const { port, close } = await startEphemeralServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    try {
      expect(port).toBeGreaterThan(0);
      expect(port).not.toBe(8787); // no hardcoded fallback

      const resp = await getJson(testBaseUrl(port) + '/');
      expect(resp.status).toBe(200);

      const body = await resp.json() as { ok: boolean };
      expect(body.ok).toBe(true);
    } finally {
      await close();
    }
  });

  it('allows independent concurrent servers on separate ports', async () => {
    const [a, b] = await Promise.all([
      startEphemeralServer((_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify({ server: 'A' }));
      }),
      startEphemeralServer((_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify({ server: 'B' }));
      }),
    ]);

    try {
      expect(a.port).not.toBe(b.port);
      const ra = await (await getJson(testBaseUrl(a.port) + '/')).json() as { server: string };
      const rb = await (await getJson(testBaseUrl(b.port) + '/')).json() as { server: string };
      expect(ra.server).toBe('A');
      expect(rb.server).toBe('B');
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });

  it('postJson sends JSON body and Content-Type header', async () => {
    let receivedBody = '';
    let receivedContentType = '';

    const { port, close } = await startEphemeralServer(async (req, res) => {
      receivedContentType = req.headers['content-type'] ?? '';
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      receivedBody = Buffer.concat(chunks).toString();
      res.writeHead(201);
      res.end();
    });

    try {
      const resp = await postJson(testBaseUrl(port) + '/items', { name: 'test' });
      expect(resp.status).toBe(201);
      expect(receivedContentType).toContain('application/json');
      expect(JSON.parse(receivedBody)).toEqual({ name: 'test' });
    } finally {
      await close();
    }
  });
});
