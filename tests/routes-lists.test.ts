import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { createStore } from '../src/store/store.ts';
import { createServer } from '../src/server/server.ts';
import { listsRoutes } from '../src/routes/lists.ts';
import type { Store } from '../src/store/types.ts';

let store: ReturnType<typeof createStore>;
let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  store = createStore();
  const mounts = listsRoutes(store);
  server = createServer(store, mounts);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function request(method: string, path: string, body?: unknown): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const opts: http.RequestOptions = {
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {},
    };
    const req = http.request(`${baseUrl}${path}`, opts, res => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('listsRoutes', () => {
  it('listsRoutes returns two RouteMounts for POST and GET /lists', () => {
    const mounts = listsRoutes(store);
    expect(mounts).toHaveLength(2);
    const post = mounts.find(m => m.method === 'POST');
    const get = mounts.find(m => m.method === 'GET');
    expect(post).toBeDefined();
    expect(post?.path).toBe('/lists');
    expect(get).toBeDefined();
    expect(get?.path).toBe('/lists');
  });

  describe('POST /lists', () => {
    it('POST /lists returns 201 with id and name', async () => {
      const res = await request('POST', '/lists', { name: 'Groceries' });
      expect(res.status).toBe(201);
      const parsed = JSON.parse(res.body);
      expect(typeof parsed.id).toBe('string');
      expect(parsed.name).toBe('Groceries');
    });

    it('POST /lists trims surrounding whitespace from name', async () => {
      const res = await request('POST', '/lists', { name: '  Groceries  ' });
      expect(res.status).toBe(201);
      const parsed = JSON.parse(res.body);
      expect(parsed.name).toBe('Groceries');
    });

    it('POST /lists returns 400 for whitespace-only name', async () => {
      const res = await request('POST', '/lists', { name: '   ' });
      expect(res.status).toBe(400);
    });

    it('POST /lists returns 400 for empty name', async () => {
      const res = await request('POST', '/lists', { name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /lists sets Content-Type application/json on success', async () => {
      const res = await request('POST', '/lists', { name: 'Work' });
      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('POST /lists assigns unique ids to each list', async () => {
      const r1 = await request('POST', '/lists', { name: 'List A' });
      const r2 = await request('POST', '/lists', { name: 'List B' });
      const p1 = JSON.parse(r1.body);
      const p2 = JSON.parse(r2.body);
      expect(p1.id).not.toBe(p2.id);
    });

    it('POST /lists returns 400 for malformed JSON body', async () => {
      const res = await new Promise<{ status: number }>((resolve, reject) => {
        const payload = 'not-json{{{';
        const req = http.request(`${baseUrl}/lists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, res => {
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode! }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /lists', () => {
    it('GET /lists returns 200 and empty array when no lists exist', async () => {
      const res = await request('GET', '/lists');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
    });

    it('GET /lists returns lists newest-first after creation', async () => {
      await request('POST', '/lists', { name: 'First' });
      await request('POST', '/lists', { name: 'Second' });
      const res = await request('GET', '/lists');
      expect(res.status).toBe(200);
      const lists = JSON.parse(res.body);
      expect(lists).toHaveLength(2);
      expect(lists[0].name).toBe('Second');
      expect(lists[1].name).toBe('First');
    });

    it('GET /lists sets Content-Type application/json', async () => {
      const res = await request('GET', '/lists');
      expect(res.headers['content-type']).toContain('application/json');
    });
  });
});
