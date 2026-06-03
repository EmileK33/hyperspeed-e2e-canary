import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import { createServer } from '../../src/server/app.ts';

let server: http.Server;
let port: number;

function get(path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => { raw += chunk; });
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ status: res.statusCode!, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe('GET /health', () => {
  it('returns 200 with JSON body {status: "ok"}', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('status field is the literal string "ok"', async () => {
    const res = await get('/health');
    expect((res.body as { status: string }).status).toBe('ok');
  });

  it('responds with Content-Type application/json', async () => {
    const res = await get('/health');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('accepts request with no auth and no body', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /healthz falls through to 404 with error body', async () => {
    const res = await get('/healthz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(typeof (res.body as { error: unknown }).error).toBe('string');
  });

  it('GET /health/extra falls through to 404 with error body', async () => {
    const res = await get('/health/extra');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(typeof (res.body as { error: unknown }).error).toBe('string');
  });
});
