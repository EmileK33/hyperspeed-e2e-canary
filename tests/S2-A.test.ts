/**
 * S2-A independent test — health route
 * Exercises GET /health via the app handler (framework-free, no real TCP).
 */

import { describe, it, expect } from 'vitest';

// Import the health module to trigger self-registration.
import '../src/routes/health.ts';

import { createApp } from '../src/app.ts';
import type { IncomingRequest, ServerResponse } from '../src/types/contracts.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes(): ServerResponse & { _body: string; _headers: Record<string, string> } {
  return {
    statusCode: 200,
    _body: '',
    _headers: {},
    setHeader(name: string, value: string) {
      (this as any)._headers[name] = value;
    },
    end(data?: string) {
      (this as any)._body = data ?? '';
    },
  };
}

function makeReq(method = 'GET', url = '/'): IncomingRequest {
  return { method, url, headers: {} };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health (US-005)', () => {
  it('AC-1: returns 200', async () => {
    const app = createApp();
    const res = makeRes();
    await app.handle(makeReq('GET', '/health'), res);
    expect(res.statusCode).toBe(200);
  });

  it('AC-1: returns { status: "ok" }', async () => {
    const app = createApp();
    const res = makeRes();
    await app.handle(makeReq('GET', '/health'), res);
    expect(JSON.parse(res._body)).toEqual({ status: 'ok' });
  });

  it('returns JSON content-type', async () => {
    const app = createApp();
    const res = makeRes();
    await app.handle(makeReq('GET', '/health'), res);
    expect(res._headers['Content-Type']).toBe('application/json');
  });

  it('unknown route returns 404', async () => {
    const app = createApp();
    const res = makeRes();
    await app.handle(makeReq('GET', '/not-a-route'), res);
    expect(res.statusCode).toBe(404);
  });

  it('healthRouter export is a function', async () => {
    const { healthRouter } = await import('../src/routes/health.ts');
    expect(typeof healthRouter).toBe('function');
  });

  it('healthRouter() returns routes array containing GET /health', async () => {
    const { healthRouter } = await import('../src/routes/health.ts');
    const routes = healthRouter();
    expect(Array.isArray(routes)).toBe(true);
    const found = routes.find(r => r.method === 'GET' && r.path === '/health');
    expect(found).toBeDefined();
  });
});
