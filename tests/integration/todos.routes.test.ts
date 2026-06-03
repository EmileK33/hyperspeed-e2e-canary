import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import { createServer } from '../../src/server/app.js';
import type { Todo } from '../../src/types.js';

const { Pool } = pg;

let server: http.Server;
let baseUrl: string;
let pool: pg.Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM todos');
});

describe('POST /todos', () => {
  it('POST /todos returns 201 with Todo body when title is valid', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk' }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toContain('application/json');
    const todo = (await res.json()) as Todo;
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
    expect(typeof todo.id === 'number' || typeof todo.id === 'string').toBe(true);
  });

  it('POST /todos returns 400 when title is missing', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('POST /todos returns 400 when title is empty string', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('POST /todos returns 400 when body is not valid JSON', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });
});

describe('GET /todos', () => {
  it('GET /todos returns 200 with an array', async () => {
    const res = await fetch(`${baseUrl}/todos`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /todos includes a previously created todo', async () => {
    await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk' }),
    });
    const res = await fetch(`${baseUrl}/todos`);
    expect(res.status).toBe(200);
    const todos = (await res.json()) as Todo[];
    expect(todos.some((t) => t.title === 'Buy milk')).toBe(true);
  });
});

describe('POST /todos/:id/toggle', () => {
  it('POST /todos/:id/toggle returns 200 with done toggled to true', async () => {
    const createRes = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Toggle me' }),
    });
    const created = (await createRes.json()) as Todo;
    expect(created.done).toBe(false);

    const toggleRes = await fetch(`${baseUrl}/todos/${created.id}/toggle`, {
      method: 'POST',
    });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.headers.get('content-type')).toContain('application/json');
    const toggled = (await toggleRes.json()) as Todo;
    expect(toggled.done).toBe(true);
    expect(String(toggled.id)).toBe(String(created.id));
  });

  it('POST /todos/:id/toggle returns 200 with done toggled back to false', async () => {
    const createRes = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Toggle back' }),
    });
    const created = (await createRes.json()) as Todo;

    await fetch(`${baseUrl}/todos/${created.id}/toggle`, { method: 'POST' });

    const toggleRes = await fetch(`${baseUrl}/todos/${created.id}/toggle`, {
      method: 'POST',
    });
    expect(toggleRes.status).toBe(200);
    const toggled = (await toggleRes.json()) as Todo;
    expect(toggled.done).toBe(false);
  });

  it('POST /todos/:id/toggle returns 404 for a non-existent id', async () => {
    const res = await fetch(`${baseUrl}/todos/99999999/toggle`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });
});
