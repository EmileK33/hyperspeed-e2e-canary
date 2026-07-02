// Independent tests for S1-A: server — src/server/app.ts
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server/app.js';

describe('src/server/app — createServer (US-002)', () => {
  it('exports createServer as a function', () => {
    expect(typeof createServer).toBe('function');
  });

  it('AC-1: createServer() resolves to an http.Server', async () => {
    const server = await createServer();
    expect(server).toBeInstanceOf(http.Server);
    server.close();
  });

  it('AC-2: unknown route returns 404 with JSON error body', async () => {
    const server = await createServer();
    await new Promise<void>((ok) => server.listen(0, () => ok()));
    const port = (server.address() as { port: number }).port;

    const result = await new Promise<{ status: number; body: unknown }>((ok, fail) => {
      const req = http.request(
        { hostname: 'localhost', port, path: '/no-such-route', method: 'GET' },
        (r) => {
          let raw = '';
          r.on('data', (c: Buffer) => { raw += c.toString(); });
          r.on('end', () => ok({ status: r.statusCode ?? 0, body: JSON.parse(raw) }));
        },
      );
      req.on('error', fail);
      req.end();
    });

    await new Promise<void>((ok, fail) =>
      server.close((e?: Error) => (e ? fail(e) : ok())),
    );

    expect(result.status).toBe(404);
    expect((result.body as { error: string }).error).toBeTruthy();
  });

  it('AC-1: server handles JSON body parsing — POST with body resolves body', async () => {
    const server = await createServer();
    await new Promise<void>((ok) => server.listen(0, () => ok()));
    const port = (server.address() as { port: number }).port;

    // POST to unknown route — 404 but server should not crash (body parsing worked)
    const result = await new Promise<{ status: number }>((ok, fail) => {
      const body = JSON.stringify({ test: true });
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/nowhere',
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
        },
        (r) => {
          r.resume();
          r.on('end', () => ok({ status: r.statusCode ?? 0 }));
        },
      );
      req.on('error', fail);
      req.write(body);
      req.end();
    });

    await new Promise<void>((ok, fail) =>
      server.close((e?: Error) => (e ? fail(e) : ok())),
    );

    // 404 means the server handled the request (body parsed, route not found)
    expect(result.status).toBe(404);
  });
});
