/**
 * S1-B independent tests -- src/http.ts
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  readBody,
  parseJsonBody,
  sendJson,
  parseQuery,
  matchPattern,
  getPathname,
} from '../src/http.ts';

function makeMockReq(body: string): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage;
  (emitter as unknown as { setEncoding: (e: string) => void }).setEncoding = () => {};
  setImmediate(() => {
    emitter.emit('data', body);
    emitter.emit('end');
  });
  return emitter;
}

type MockRes = ServerResponse & { _status: number; _headers: Record<string, unknown>; _body: string };

function makeMockRes(): MockRes {
  const res = {
    _status: 0,
    _headers: {} as Record<string, unknown>,
    _body: '',
    writeHead(this: MockRes, status: number, headers: Record<string, unknown>) {
      this._status = status;
      this._headers = { ...headers };
    },
    end(this: MockRes, payload: string) {
      this._body = payload;
    },
  } as unknown as MockRes;
  return res;
}

describe('readBody', () => {
  it('resolves with the full body string', async () => {
    const req = makeMockReq('hello world');
    expect(await readBody(req)).toBe('hello world');
  });

  it('resolves with empty string when body is empty', async () => {
    const req = makeMockReq('');
    expect(await readBody(req)).toBe('');
  });

  it('accumulates multiple data chunks', async () => {
    const emitter = new EventEmitter() as IncomingMessage;
    (emitter as unknown as { setEncoding: (e: string) => void }).setEncoding = () => {};
    setImmediate(() => {
      emitter.emit('data', 'foo');
      emitter.emit('data', 'bar');
      emitter.emit('end');
    });
    expect(await readBody(emitter)).toBe('foobar');
  });

  it('rejects on error', async () => {
    const emitter = new EventEmitter() as IncomingMessage;
    (emitter as unknown as { setEncoding: (e: string) => void }).setEncoding = () => {};
    setImmediate(() => emitter.emit('error', new Error('network error')));
    await expect(readBody(emitter)).rejects.toThrow('network error');
  });
});

describe('parseJsonBody', () => {
  it('parses a valid JSON object', async () => {
    expect(await parseJsonBody(makeMockReq('{"title":"Buy milk"}'))).toEqual({ title: 'Buy milk' });
  });

  it('parses a JSON array', async () => {
    expect(await parseJsonBody(makeMockReq('[1,2,3]'))).toEqual([1, 2, 3]);
  });

  it('returns null for empty body', async () => {
    expect(await parseJsonBody(makeMockReq(''))).toBeNull();
  });

  it('returns null for whitespace-only body', async () => {
    expect(await parseJsonBody(makeMockReq('   '))).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    expect(await parseJsonBody(makeMockReq('{not json}'))).toBeNull();
  });

  it('parses a JSON primitive string', async () => {
    expect(await parseJsonBody(makeMockReq('"hello"'))).toBe('hello');
  });
});

describe('sendJson', () => {
  it('writes the correct status code', () => {
    const res = makeMockRes();
    sendJson(res, 201, { id: 1 });
    expect(res._status).toBe(201);
  });

  it('sets Content-Type to application/json', () => {
    const res = makeMockRes();
    sendJson(res, 200, { ok: true });
    expect(res._headers['Content-Type']).toBe('application/json');
  });

  it('serialises the body to JSON', () => {
    const res = makeMockRes();
    sendJson(res, 200, { message: 'hello' });
    expect(res._body).toBe('{"message":"hello"}');
  });

  it('sets Content-Length matching the payload', () => {
    const res = makeMockRes();
    const body = { list: [1, 2, 3] };
    sendJson(res, 200, body);
    expect(res._headers['Content-Length']).toBe(Buffer.byteLength(JSON.stringify(body)));
  });

  it('handles 404 with error body', () => {
    const res = makeMockRes();
    sendJson(res, 404, { error: 'Not found' });
    expect(res._status).toBe(404);
    expect(JSON.parse(res._body)).toEqual({ error: 'Not found' });
  });

  it('serialises null body', () => {
    const res = makeMockRes();
    sendJson(res, 200, null);
    expect(res._body).toBe('null');
  });
});

describe('parseQuery', () => {
  it('returns empty object when no query string', () => {
    expect(parseQuery('/todos')).toEqual({});
  });

  it('parses a single key=value pair', () => {
    expect(parseQuery('/todos?done=true')).toEqual({ done: 'true' });
  });

  it('parses multiple pairs', () => {
    expect(parseQuery('/todos?done=false&list_id=3')).toEqual({ done: 'false', list_id: '3' });
  });

  it('handles keys without values', () => {
    expect(parseQuery('/todos?flag')).toEqual({ flag: '' });
  });

  it('decodes percent-encoded characters', () => {
    expect(parseQuery('/search?q=hello%20world')).toEqual({ q: 'hello world' });
  });

  it('returns empty object for undefined', () => {
    expect(parseQuery(undefined)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseQuery('')).toEqual({});
  });

  it('handles URL with only a question mark', () => {
    expect(parseQuery('/todos?')).toEqual({});
  });

  it('last occurrence wins for duplicate keys', () => {
    expect(parseQuery('/todos?x=1&x=2')).toEqual({ x: '2' });
  });
});

describe('matchPattern', () => {
  it('matches an exact path with no params', () => {
    expect(matchPattern('/todos', '/todos')).toEqual({});
  });

  it('returns null when paths differ', () => {
    expect(matchPattern('/todos', '/lists')).toBeNull();
  });

  it('extracts a single named param', () => {
    expect(matchPattern('/todos/:id', '/todos/42')).toEqual({ id: '42' });
  });

  it('extracts multiple named params', () => {
    expect(matchPattern('/lists/:listId/todos/:id', '/lists/5/todos/99')).toEqual({ listId: '5', id: '99' });
  });

  it('returns null when segment count is too few', () => {
    expect(matchPattern('/todos/:id', '/todos')).toBeNull();
  });

  it('returns null when segment count is too many', () => {
    expect(matchPattern('/todos', '/todos/42')).toBeNull();
  });

  it('decodes percent-encoded param values', () => {
    expect(matchPattern('/items/:name', '/items/hello%20world')).toEqual({ name: 'hello world' });
  });

  it('matches root path', () => {
    expect(matchPattern('/', '/')).toEqual({});
  });

  it('matches nested path with trailing literal', () => {
    expect(matchPattern('/todos/:id/toggle', '/todos/7/toggle')).toEqual({ id: '7' });
  });

  it('returns null when literal segment does not match', () => {
    expect(matchPattern('/todos/:id/toggle', '/todos/7/done')).toBeNull();
  });
});

describe('getPathname', () => {
  it('returns the path when no query string', () => {
    expect(getPathname('/todos')).toBe('/todos');
  });

  it('strips the query string', () => {
    expect(getPathname('/todos?done=true')).toBe('/todos');
  });

  it('returns / for undefined', () => {
    expect(getPathname(undefined)).toBe('/');
  });

  it('returns / for empty string', () => {
    expect(getPathname('')).toBe('/');
  });

  it('handles root path with query', () => {
    expect(getPathname('/?foo=bar')).toBe('/');
  });

  it('preserves nested paths', () => {
    expect(getPathname('/todos/42/toggle?confirm=1')).toBe('/todos/42/toggle');
  });
});
