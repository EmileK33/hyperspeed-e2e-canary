// tests/S1-A.test.ts — independent test for Session S1-A (server bootstrap)
//
// Exercises src/server/app.ts in isolation.
// US-002 ACs:
//   AC-1: createServer() returns a configured app with JSON parsing enabled.
//   AC-2: An unknown route returns 404 with a JSON error body.

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server/app.js';

// Helper: start server on a random port, run callback, then close.
async function withServer(
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = await createServer();
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

// Simple fetch helper using node:http (no undici needed).
function get(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch { body = null; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    }).on('error', reject);
  });
}

describe('S1-A: src/server/app.ts', () => {
  it('exports createServer as a function', () => {
    expect(typeof createServer).toBe('function');
  });

  it('createServer() resolves to an http.Server instance', async () => {
    const server = await createServer();
    expect(server).toBeInstanceOf(http.Server);
    // don't listen — just check the instance
  });

  it('AC-2: unknown route returns 404 with JSON error body', async () => {
    await withServer(async (baseUrl) => {
      const { status, body } = await get(`${baseUrl}/this-path-does-not-exist`);
      expect(status).toBe(404);
      expect(body).toMatchObject({ error: expect.any(String) });
    });
  });

  it('AC-2: unknown nested route also returns 404 JSON', async () => {
    await withServer(async (baseUrl) => {
      const { status, body } = await get(`${baseUrl}/no/such/route`);
      expect(status).toBe(404);
      expect(typeof (body as Record<string, unknown>).error).toBe('string');
    });
  });

  it('AC-1: response content-type is application/json for 404 errors', async () => {
    const server = await createServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.once('error', reject);
    });
    const addr = server.address() as { port: number };
    const contentType = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${addr.port}/unknown`, (res) => {
        res.resume(); // drain
        resolve(res.headers['content-type'] ?? '');
      }).on('error', reject);
    });
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    expect(contentType).toMatch(/application\/json/);
  });
});
