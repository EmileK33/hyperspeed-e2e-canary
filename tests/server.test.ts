import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from '../src/server/server.ts';
import type { Store, RouteMount } from '../src/store/types.ts';

const storeStub: Store = {
  createList: () => { throw new Error('unused'); },
  getLists: () => [],
  createTodo: () => { throw new Error('unused'); },
  getTodosByList: () => [],
  getTodoById: () => undefined,
  toggleTodo: () => undefined,
  deleteTodo: () => false,
  getSnapshot: () => ({ lists: [], todos: [] }),
};

function request(
  server: http.Server,
  options: { method?: string; path: string }
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      { host: '127.0.0.1', port: addr.port, method: options.method ?? 'GET', path: options.path },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

describe('createServer', () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await close(server);
      server = null;
    }
  });

  it('returns an http.Server without calling listen', () => {
    const s = createServer(storeStub, []);
    expect(s).toBeInstanceOf(http.Server);
    expect(s.listening).toBe(false);
    s.close();
    server = null;
  });

  it('does not import src/store/store.ts', () => {
    const filePath = path.resolve('src/server/server.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/store\/store/);
    expect(src).not.toMatch(/from ['"].*store\/store/);
  });

  it('imports only from node:http and src/store/types', () => {
    const filePath = path.resolve('src/server/server.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    const imports = [...src.matchAll(/^import\s.*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const imp of imports) {
      const valid = imp === 'node:http' || imp.includes('store/types');
      expect(valid, `unexpected import: ${imp}`).toBe(true);
    }
  });

  it('exports createServer with the documented signature', () => {
    expect(typeof createServer).toBe('function');
    const s = createServer(storeStub, []);
    expect(s).toBeInstanceOf(http.Server);
    s.close();
  });

  it('dispatches GET /foo to the matching mount with empty params', async () => {
    let captured: Record<string, string> | null = null;
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/foo',
        handler: (_req, res, params) => {
          captured = params;
          res.writeHead(200);
          res.end();
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    const { status } = await request(server, { path: '/foo' });
    expect(status).toBe(200);
    expect(captured).toEqual({});
  });

  it('extracts :id from /lists/:id/todos into params', async () => {
    let captured: Record<string, string> | null = null;
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/lists/:id/todos',
        handler: (_req, res, params) => {
          captured = params;
          res.writeHead(200);
          res.end();
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    await request(server, { path: '/lists/abc/todos' });
    expect(captured).toEqual({ id: 'abc' });
  });

  it('matches request method case-insensitively against uppercase mount', async () => {
    let called = false;
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/bar',
        handler: (_req, res) => {
          called = true;
          res.writeHead(200);
          res.end();
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    const { status } = await request(server, { method: 'get', path: '/bar' });
    expect(status).toBe(200);
    expect(called).toBe(true);
  });

  it('strips querystring before matching', async () => {
    let called = false;
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/foo',
        handler: (_req, res) => {
          called = true;
          res.writeHead(200);
          res.end();
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    const { status } = await request(server, { path: '/foo?x=1&y=2' });
    expect(status).toBe(200);
    expect(called).toBe(true);
  });

  it('responds 404 JSON when no mount matches', async () => {
    server = createServer(storeStub, []);
    await listen(server);
    const { status, body, headers } = await request(server, { path: '/missing' });
    expect(status).toBe(404);
    expect(headers['content-type']).toMatch(/application\/json/);
    expect(JSON.parse(body)).toEqual({ error: 'not found' });
  });

  it('invokes the first matching mount only', async () => {
    const calls: number[] = [];
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/dup',
        handler: (_req, res) => {
          calls.push(1);
          res.writeHead(200);
          res.end();
        },
      },
      {
        method: 'GET',
        path: '/dup',
        handler: (_req, res) => {
          calls.push(2);
          res.writeHead(200);
          res.end();
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    await request(server, { path: '/dup' });
    expect(calls).toEqual([1]);
  });

  it('responds 500 when handler throws synchronously', async () => {
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/boom',
        handler: () => {
          throw new Error('sync error');
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    const { status, body } = await request(server, { path: '/boom' });
    expect(status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: 'internal' });
  });

  it('responds 500 when handler returns a rejected promise', async () => {
    const mounts: RouteMount[] = [
      {
        method: 'GET',
        path: '/async-boom',
        handler: async () => {
          throw new Error('async error');
        },
      },
    ];
    server = createServer(storeStub, mounts);
    await listen(server);
    const { status, body } = await request(server, { path: '/async-boom' });
    expect(status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: 'internal' });
  });
});
