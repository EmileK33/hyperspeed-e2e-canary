// tests/routes-health.test.ts
// TDD: write this file first; all tests must FAIL before src/routes/health.ts is implemented.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { healthRoute } from '../src/routes/health.ts';

const makeMockReq = (): IncomingMessage => ({} as IncomingMessage);

type MockRes = {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} & ServerResponse;

const makeMockRes = (): MockRes => ({
  writeHead: vi.fn(),
  end: vi.fn(),
} as unknown as MockRes);

describe('healthRoute', () => {
  it('healthRoute is a named export', () => {
    expect(typeof healthRoute).toBe('function');
  });

  it('returns RouteMount with method GET', () => {
    const mount = healthRoute(Date.now());
    expect(mount.method).toBe('GET');
  });

  it('returns RouteMount with path /healthz', () => {
    const mount = healthRoute(Date.now());
    expect(mount.path).toBe('/healthz');
  });

  it('returns RouteMount with a handler function', () => {
    const mount = healthRoute(Date.now());
    expect(typeof mount.handler).toBe('function');
  });

  describe('handler', () => {
    it('calls writeHead with 200', async () => {
      const startTime = Date.now();
      const mount = healthRoute(startTime);
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'Content-Type': 'application/json' })
      );
    });

    it('sets Content-Type application/json', async () => {
      const mount = healthRoute(Date.now());
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const [, headers] = res.writeHead.mock.calls[0];
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('writes valid JSON body', async () => {
      const mount = healthRoute(Date.now());
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const body = res.end.mock.calls[0][0] as string;
      expect(() => JSON.parse(body)).not.toThrow();
    });

    it("body has status 'ok'", async () => {
      const mount = healthRoute(Date.now());
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const body = JSON.parse(res.end.mock.calls[0][0] as string);
      expect(body.status).toBe('ok');
    });

    it('body has uptimeMs as a non-negative number', async () => {
      const mount = healthRoute(Date.now());
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const body = JSON.parse(res.end.mock.calls[0][0] as string);
      expect(typeof body.uptimeMs).toBe('number');
      expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('uptimeMs approximates elapsed time since startTime', async () => {
      const startTime = Date.now() - 500; // simulate 500ms ago
      const mount = healthRoute(startTime);
      const req = makeMockReq();
      const res = makeMockRes();
      const before = Date.now();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const after = Date.now();
      const body = JSON.parse(res.end.mock.calls[0][0] as string);
      const expectedMin = before - startTime;
      const expectedMax = after - startTime;
      expect(body.uptimeMs).toBeGreaterThanOrEqual(expectedMin - 10);
      expect(body.uptimeMs).toBeLessThanOrEqual(expectedMax + 10);
    });

    it('uptimeMs is 0 when startTime is in the future', async () => {
      const startTime = Date.now() + 10_000; // 10 seconds in the future
      const mount = healthRoute(startTime);
      const req = makeMockReq();
      const res = makeMockRes();
      await mount.handler(req, res as unknown as ServerResponse, {});
      const body = JSON.parse(res.end.mock.calls[0][0] as string);
      expect(body.uptimeMs).toBe(0);
    });
  });
});
