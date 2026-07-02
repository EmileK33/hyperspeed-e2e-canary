/**
 * Phase-0 integration smoke tests.
 *
 * Rules:
 *  - Must pass at every integration wave, including integration-0 before
 *    ANY feature route session has merged.
 *  - Must NOT import from src/ at the top level (app may not exist yet).
 *  - Must NOT probe the future endpoint surface — that belongs to the
 *    terminal boot-gate.
 *  - Must use an ephemeral port (0), never a hardcoded port number.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  testFetch,
  postJson,
  type TestServer,
} from './fixtures.ts';
import './setup.ts';

// ---------------------------------------------------------------------------
// Fixture wiring
// ---------------------------------------------------------------------------

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'POST' && req.url === '/echo') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body || '{}');
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
});

afterAll(async () => {
  await server.close();
});

// ---------------------------------------------------------------------------
// Harness self-checks
// ---------------------------------------------------------------------------

describe('integration harness', () => {
  it('starts an ephemeral server with a non-zero port', () => {
    expect(server.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const port = Number(new URL(server.baseUrl).port);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('baseUrl does not use a fixed port (avoids 8787 collision)', () => {
    const port = Number(new URL(server.baseUrl).port);
    expect(port).not.toBe(8787);
  });
});

// ---------------------------------------------------------------------------
// HTTP helper checks
// ---------------------------------------------------------------------------

describe('testFetch helper', () => {
  it('GET /ping returns 200 with JSON body', async () => {
    const res = await testFetch(`${server.baseUrl}/ping`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await testFetch(`${server.baseUrl}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('captures response headers', async () => {
    const res = await testFetch(`${server.baseUrl}/ping`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('postJson helper', () => {
  it('POST /echo round-trips a JSON payload', async () => {
    const payload = { hello: 'world', n: 42 };
    const res = await postJson(`${server.baseUrl}/echo`, payload);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// Node runtime guard (mirrors setup.ts, surfaces a clear failure message)
// ---------------------------------------------------------------------------

describe('runtime environment', () => {
  it('Node.js major version >= 18 (built-in fetch available)', () => {
    const major = Number(process.versions.node.split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(18);
  });

  it('built-in fetch is defined', () => {
    expect(typeof fetch).toBe('function');
  });

  it('NODE_ENV is set to test', () => {
    expect(process.env['NODE_ENV']).toBe('test');
  });
});
