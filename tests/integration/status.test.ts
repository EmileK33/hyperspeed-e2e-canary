import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createServer } from '../../src/server/app.js';

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = createServer();
  await new Promise<void>(resolve => server.listen(0, resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function url(path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

describe('GET /status', () => {
  it('returns 200 with version, uptimeSeconds, and brandColor', async () => {
    const res = await fetch(url('/status'));
    expect(res.status).toBe(200);
    const body = await res.json() as { version: unknown; uptimeSeconds: unknown; brandColor: unknown };
    expect(typeof body.version).toBe('string');
    expect((body.version as string).length).toBeGreaterThan(0);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.brandColor).toBe('string');
  });

  it('uptimeSeconds is a non-negative number', async () => {
    const res = await fetch(url('/status'));
    const body = await res.json() as { uptimeSeconds: number };
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('response Content-Type is application/json', async () => {
    const res = await fetch(url('/status'));
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('brandColor equals the literal string #3a86ff', async () => {
    const res = await fetch(url('/status'));
    const body = await res.json() as { brandColor: string };
    expect(body.brandColor).toBe('#3a86ff');
  });

  it('response body has exactly the keys version, uptimeSeconds, brandColor', async () => {
    const res = await fetch(url('/status'));
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['brandColor', 'uptimeSeconds', 'version']);
  });
});

// [MANUAL] US-006 AC-2: A human reviewer must visually confirm the literal hex string
// #3a86ff appears verbatim in the deployed GET /status response body.
