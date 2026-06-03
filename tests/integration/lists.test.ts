import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import pg from 'pg';
import { createServer } from '../../src/server/app.js';
import { setup } from './setup.js';

const { Pool } = pg;

let server: http.Server;
let port: number;
let pool: pg.Pool;

beforeAll(async () => {
  await setup();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  server = createServer();
  await new Promise<void>(resolve => server.listen(0, resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
});

function url(path: string): string {
  return `http://localhost:${port}${path}`;
}

async function postList(name: unknown) {
  return fetch(url('/lists'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

describe('POST /lists', () => {
  it('returns 201 with the created TodoList shape', async () => {
    const uniqueName = `groceries-${Date.now()}-${Math.random()}`;
    const res = await postList(uniqueName);
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json() as { id: unknown; name: unknown };
    expect(typeof body.id === 'number' || typeof body.id === 'string').toBe(true);
    expect(body.name).toBe(uniqueName);
  });

  it('persists a row to the lists table', async () => {
    const uniqueName = `persist-${Date.now()}-${Math.random()}`;
    const res = await postList(uniqueName);
    expect(res.status).toBe(201);
    const created = await res.json() as { id: number; name: string };
    const { rows } = await pool.query<{ id: number; name: string }>(
      'SELECT id, name FROM lists WHERE id = $1',
      [created.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(uniqueName);
  });

  it('with missing name returns 4xx and ErrorBody', async () => {
    const res = await fetch(url('/lists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'oops' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = await res.json() as { error: unknown };
    expect(typeof body.error).toBe('string');
  });

  it('with non-JSON body returns 4xx and ErrorBody', async () => {
    const res = await fetch(url('/lists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = await res.json() as { error: unknown };
    expect(typeof body.error).toBe('string');
  });

  it('invalid body does not insert a row', async () => {
    const { rows: before } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM lists'
    );
    const countBefore = parseInt(before[0].count, 10);

    await fetch(url('/lists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notname: 'foo' }),
    });

    const { rows: after } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM lists'
    );
    expect(parseInt(after[0].count, 10)).toBe(countBefore);
  });
});

describe('GET /lists', () => {
  it('returns 200 with an array of TodoList objects', async () => {
    const res = await fetch(url('/lists'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    for (const item of body) {
      const typed = item as { id: unknown; name: unknown };
      expect(typeof typed.id === 'number' || typeof typed.id === 'string').toBe(true);
      expect(typeof typed.name).toBe('string');
    }
  });

  it('includes a row just inserted via POST /lists', async () => {
    const uniqueName = `visible-${Date.now()}-${Math.random()}`;
    const post = await postList(uniqueName);
    expect(post.status).toBe(201);
    const created = await post.json() as { id: number; name: string };

    const res = await fetch(url('/lists'));
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: number; name: string }>;
    const found = body.find(item => item.id === created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(uniqueName);
  });
});

describe('unknown sub-paths', () => {
  it('GET /lists/unknown does not return 200 from lists routes', async () => {
    const res = await fetch(url('/lists/unknown'));
    expect(res.status).not.toBe(200);
  });
});
