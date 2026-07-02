// Independent test for Session S1-A — HTTP server bootstrap (US-002).
// Exercises src/server/app.ts in isolation without a real Postgres or network.
// Run: npm run test -- tests/S1-A.test.ts

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';

describe('src/server/app.ts — createServer', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    for (const s of servers) {
      if (s.listening) {
        await new Promise<void>((res) => s.close(() => res()));
      }
    }
    servers.length = 0;
  });

  it('exports createServer as a function', async () => {
    const mod = await import('../src/server/app.js');
    expect(typeof mod.createServer).toBe('function');
  });

  it('createServer() resolves to an http.Server instance', async () => {
    const { createServer } = await import('../src/server/app.js');
    const server = await createServer();
    servers.push(server);
    expect(server).toBeInstanceOf(http.Server);
  });

  it('AC-1: server returns JSON for a known route (health-style self-check)', async () => {
    const { createServer } = await import('../src/server/app.js');
    const server = await createServer();
    servers.push(server);

    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as { port: number }).port;

    const body = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${port}/`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });

    // Should return JSON (either a route match or 404 JSON error)
    expect(() => JSON.parse(body)).not.toThrow();
  });

  it('AC-2: unknown route returns 404 with JSON error body', async () => {
    const { createServer } = await import('../src/server/app.js');
    const server = await createServer();
    servers.push(server);

    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as { port: number }).port;

    const { status, body } = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http.get(`http://localhost:${port}/this-route-does-not-exist`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }).on('error', reject);
    });

    expect(status).toBe(404);
    const json = JSON.parse(body);
    expect(json).toHaveProperty('error');
  });
});
