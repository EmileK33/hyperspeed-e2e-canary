/**
 * S1-B independent test -- src/http.ts
 * Exercises HTTP helpers in isolation (no network, no DB).
 */

import { describe, it, expect } from 'vitest';
import {
  sendJson,
  ok,
  created,
  badRequest,
  notFound,
  internalError,
  getBody,
  extractParam,
  matchesPattern,
} from '../src/http.ts';
import type { Route } from '../src/http.ts';
import type { ServerResponse, IncomingRequest } from '../src/types/contracts.ts';

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

function makeReq(body?: unknown): IncomingRequest {
  return { method: 'POST', url: '/', headers: {}, body };
}

describe('sendJson', () => {
  it('sets status code', () => {
    const res = makeRes();
    sendJson(res, 201, { id: 1 });
    expect(res.statusCode).toBe(201);
  });

  it('sets Content-Type header', () => {
    const res = makeRes();
    sendJson(res, 200, {});
    expect(res._headers['Content-Type']).toBe('application/json');
  });

  it('serialises body to JSON', () => {
    const res = makeRes();
    sendJson(res, 200, { hello: 'world' });
    expect(JSON.parse(res._body)).toEqual({ hello: 'world' });
  });

  it('handles array body', () => {
    const res = makeRes();
    sendJson(res, 200, [1, 2, 3]);
    expect(JSON.parse(res._body)).toEqual([1, 2, 3]);
  });

  it('handles null body', () => {
    const res = makeRes();
    sendJson(res, 204, null);
    expect(JSON.parse(res._body)).toBeNull();
  });
});

describe('ok', () => {
  it('responds with 200', () => {
    const res = makeRes();
    ok(res, { ok: true });
    expect(res.statusCode).toBe(200);
  });

  it('serialises body', () => {
    const res = makeRes();
    ok(res, { items: [] });
    expect(JSON.parse(res._body)).toEqual({ items: [] });
  });
});

describe('created', () => {
  it('responds with 201', () => {
    const res = makeRes();
    created(res, { id: 5 });
    expect(res.statusCode).toBe(201);
  });

  it('serialises body', () => {
    const res = makeRes();
    created(res, { id: 5, title: 'new' });
    expect(JSON.parse(res._body).title).toBe('new');
  });
});

describe('badRequest', () => {
  it('responds with 400', () => {
    const res = makeRes();
    badRequest(res);
    expect(res.statusCode).toBe(400);
  });

  it('includes default error message', () => {
    const res = makeRes();
    badRequest(res);
    expect(JSON.parse(res._body).error).toBe('Bad request');
  });

  it('accepts custom message', () => {
    const res = makeRes();
    badRequest(res, 'title is required');
    expect(JSON.parse(res._body).error).toBe('title is required');
  });
});

describe('notFound', () => {
  it('responds with 404', () => {
    const res = makeRes();
    notFound(res);
    expect(res.statusCode).toBe(404);
  });

  it('includes default error message', () => {
    const res = makeRes();
    notFound(res);
    expect(JSON.parse(res._body).error).toBe('Not found');
  });

  it('accepts custom message', () => {
    const res = makeRes();
    notFound(res, 'Todo not found');
    expect(JSON.parse(res._body).error).toBe('Todo not found');
  });
});

describe('internalError', () => {
  it('responds with 500', () => {
    const res = makeRes();
    internalError(res);
    expect(res.statusCode).toBe(500);
  });

  it('includes default error message', () => {
    const res = makeRes();
    internalError(res);
    expect(JSON.parse(res._body).error).toBe('Internal server error');
  });

  it('accepts custom message', () => {
    const res = makeRes();
    internalError(res, 'DB unavailable');
    expect(JSON.parse(res._body).error).toBe('DB unavailable');
  });
});

describe('getBody', () => {
  it('returns body when present', () => {
    const req = makeReq({ title: 'Buy milk' });
    expect(getBody<{ title: string }>(req)?.title).toBe('Buy milk');
  });

  it('returns undefined when body absent', () => {
    const req = makeReq(undefined);
    expect(getBody(req)).toBeUndefined();
  });

  it('handles array body', () => {
    const req = makeReq([1, 2, 3]);
    expect(getBody<number[]>(req)).toEqual([1, 2, 3]);
  });
});

describe('matchesPattern', () => {
  it('matches exact path', () => {
    expect(matchesPattern('/health', '/health')).toBe(true);
  });

  it('matches parameterised path', () => {
    expect(matchesPattern('/todos/42', '/todos/:id')).toBe(true);
  });

  it('matches multi-segment pattern', () => {
    expect(matchesPattern('/todos/7/toggle', '/todos/:id/toggle')).toBe(true);
  });

  it('does not match different path', () => {
    expect(matchesPattern('/todos', '/lists')).toBe(false);
  });

  it('does not match different segment count', () => {
    expect(matchesPattern('/todos/1/toggle/extra', '/todos/:id/toggle')).toBe(false);
  });

  it('strips query string before matching', () => {
    expect(matchesPattern('/todos/5?done=true', '/todos/:id')).toBe(true);
  });
});

describe('extractParam', () => {
  it('extracts id from path', () => {
    expect(extractParam('/todos/42', '/todos/:id', 'id')).toBe('42');
  });

  it('extracts id from multi-segment path', () => {
    expect(extractParam('/todos/7/toggle', '/todos/:id/toggle', 'id')).toBe('7');
  });

  it('returns undefined when param not in pattern', () => {
    expect(extractParam('/todos/7', '/todos/:id', 'name')).toBeUndefined();
  });

  it('returns undefined when path does not match pattern', () => {
    expect(extractParam('/lists/3', '/todos/:id', 'id')).toBeUndefined();
  });

  it('strips query string before extracting', () => {
    expect(extractParam('/todos/99?x=1', '/todos/:id', 'id')).toBe('99');
  });
});

describe('Route type re-export', () => {
  it('Route type is usable for handler construction', () => {
    const route: Route = {
      method: 'GET',
      path: '/ping',
      handler: (_req, res) => { ok(res, { pong: true }); },
    };
    expect(route.method).toBe('GET');
    expect(route.path).toBe('/ping');
    expect(typeof route.handler).toBe('function');
  });

  it('Route handler can use http helpers', () => {
    const res = makeRes();
    const route: Route = {
      method: 'POST',
      path: '/echo',
      handler: (req, r) => { ok(r, getBody(req)); },
    };
    route.handler(makeReq({ echo: 'hi' }), res);
    expect(JSON.parse(res._body)).toEqual({ echo: 'hi' });
  });
});
