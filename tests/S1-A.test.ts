/**
 * S1-A independent test — server
 * Exercises src/server/app.ts in isolation (no network, no DB).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createServer } from '../src/server/app.ts';
import { clearRoutes, registerRoutes } from '../src/routes/index.ts';
import type { Route, IncomingRequest, ServerResponse } from '../src/types/contracts.ts';

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

function makeReq(
  method = 'GET',
  url = '/',
  body?: unknown
): IncomingRequest {
  return { method, url, headers: {}, body };
}

describe('src/server/app.ts — createServer', () => {
  beforeEach(() => clearRoutes());

  it('createServer returns a ServerApp with required methods', () => {
    const server = createServer();
    expect(typeof server.handle).toBe('function');
    expect(typeof server.getRoutes).toBe('function');
    expect(typeof server.addRoutes).toBe('function');
    expect(server.app).toBeDefined();
  });

  it('getRoutes returns an array', () => {
    expect(Array.isArray(createServer().getRoutes())).toBe(true);
  });

  it('addRoutes mounts a route', () => {
    const server = createServer();
    const r: Route = { method: 'GET', path: '/ping', handler: () => {} };
    server.addRoutes([r]);
    expect(server.getRoutes()).toContain(r);
  });

  it('unknown route returns 404 (AC-2)', async () => {
    const server = createServer();
    const res = makeRes();
    await server.handle(makeReq('GET', '/does-not-exist'), res);
    expect(res.statusCode).toBe(404);
  });

  it('unknown route 404 body contains JSON error (AC-2)', async () => {
    const server = createServer();
    const res = makeRes();
    await server.handle(makeReq('GET', '/nope'), res);
    const parsed = JSON.parse(res._body);
    expect(parsed).toHaveProperty('error');
  });

  it('handle invokes matched route handler (AC-1)', async () => {
    let called = false;
    const server = createServer({
      routes: [
        {
          method: 'GET',
          path: '/hello',
          handler: (_req, res) => {
            called = true;
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
          },
        },
      ],
    });
    const res = makeRes();
    await server.handle(makeReq('GET', '/hello'), res);
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('JSON body string is parsed before routing (AC-1 — JSON parsing)', async () => {
    let receivedBody: unknown;
    const server = createServer({
      routes: [
        {
          method: 'POST',
          path: '/data',
          handler: (req, res) => {
            receivedBody = req.body;
            res.statusCode = 200;
            res.end('{}');
          },
        },
      ],
    });
    const res = makeRes();
    const req = makeReq('POST', '/data', '{"title":"test"}');
    await server.handle(req, res);
    expect(receivedBody).toEqual({ title: 'test' });
  });

  it('non-JSON string body is left as-is', async () => {
    let receivedBody: unknown;
    const server = createServer({
      routes: [
        {
          method: 'POST',
          path: '/raw',
          handler: (req, res) => {
            receivedBody = req.body;
            res.statusCode = 200;
            res.end('{}');
          },
        },
      ],
    });
    const res = makeRes();
    const req = makeReq('POST', '/raw', 'not-json');
    await server.handle(req, res);
    expect(receivedBody).toBe('not-json');
  });

  it('picks up routes from the global registry', () => {
    const r: Route = { method: 'GET', path: '/global', handler: () => {} };
    registerRoutes([r]);
    const server = createServer();
    expect(server.getRoutes()).toContain(r);
  });

  it('handle strips query string before matching', async () => {
    const server = createServer({
      routes: [
        {
          method: 'GET',
          path: '/items',
          handler: (_req, res) => { res.end('[]'); },
        },
      ],
    });
    const res = makeRes();
    await server.handle(makeReq('GET', '/items?sort=asc'), res);
    expect(res.statusCode).toBe(200);
  });

  it('sets Content-Type: application/json header', async () => {
    const server = createServer();
    const res = makeRes();
    await server.handle(makeReq('GET', '/no-route'), res);
    expect(res._headers['Content-Type']).toBe('application/json');
  });
});
