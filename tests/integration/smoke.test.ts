/**
 * Integration harness smoke tests — phase-safe.
 *
 * Rules:
 *  - MUST pass at every integration wave (including wave-0 before any feature
 *    route has been merged).
 *  - MUST NOT import from src/ feature modules.
 *  - MUST use ephemeral ports (port 0) — never a hard-coded port.
 *  - MAY test fixture helpers, harness plumbing, and basic HTTP round-trips.
 *
 * Full endpoint probes (GET /health, POST /todos, …) belong to the terminal
 * boot-gate after all feature sessions have merged, NOT here.
 */
import { describe, it, expect } from 'vitest';
import { startTestServer, httpGet, httpPost, expectJson } from './fixtures.ts';

// ---------------------------------------------------------------------------
// Harness self-test
// ---------------------------------------------------------------------------

describe('integration harness — fixtures', () => {
  it('passes basic arithmetic (sanity)', () => {
    expect(1 + 1).toBe(2);
  });

  it('startTestServer: binds to an OS-assigned port > 0', async () => {
    const ts = await startTestServer((_req, res) => {
      res.writeHead(200);
      res.end('alive');
    });
    try {
      expect(ts.port).toBeGreaterThan(0);
      expect(ts.port).toBeLessThanOrEqual(65535);
      expect(ts.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      await ts.close();
    }
  });

  it('startTestServer: two concurrent servers get different ports', async () => {
    const [ts1, ts2] = await Promise.all([
      startTestServer((_req, res) => res.end('a')),
      startTestServer((_req, res) => res.end('b')),
    ]);
    try {
      expect(ts1.port).not.toBe(ts2.port);
    } finally {
      await Promise.all([ts1.close(), ts2.close()]);
    }
  });

  it('httpGet: can reach a live ephemeral server', async () => {
    const ts = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('pong');
    });
    try {
      const res = await httpGet(ts.baseUrl + '/ping');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('pong');
    } finally {
      await ts.close();
    }
  });

  it('httpPost + expectJson: round-trips JSON payload', async () => {
    const ts = await startTestServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const payload = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ echo: payload.msg, received: true }));
      });
    });
    try {
      const res = await httpPost(ts.baseUrl + '/echo', { msg: 'hello' });
      const json = await expectJson(res, 200) as { echo: string; received: boolean };
      expect(json.echo).toBe('hello');
      expect(json.received).toBe(true);
    } finally {
      await ts.close();
    }
  });

  it('ts.close(): released port does not accept new connections', async () => {
    const ts = await startTestServer((_req, res) => res.end('ok'));
    const { port } = ts;
    await ts.close();

    // After close, fetch to the same port must fail.
    await expect(
      fetch(`http://127.0.0.1:${port}/`),
    ).rejects.toThrow();
  });
});
