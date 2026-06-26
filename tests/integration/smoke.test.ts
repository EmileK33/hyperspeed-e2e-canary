/**
 * Integration smoke tests — cross-session gate.
 *
 * These tests exercise every major contract exported by the application:
 *   US-001  createTodo  — POST /todos
 *   US-002  getTodo     — GET  /todos/:id
 *   US-003  listTodos   — GET  /todos  &  GET /lists
 *   US-004  statusRouter — GET /status  (incl. brand colour #3a86ff)
 *   US-005  healthRouter — GET /health
 *   US-006  toggleTodo  — PATCH /todos/:id/toggle
 *
 * The suite must stay green after every integration wave.  Later feature
 * sessions (S1–S3) deepen coverage; this file owns the baseline contract.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, api, type Todo } from './fixtures.ts';

// ─── Server lifecycle ──────────────────────────────────────────────────────

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const srv = await startTestServer();
  baseUrl = srv.baseUrl;
  close = srv.close;
});

afterAll(async () => {
  await close();
});

// ─── US-005 — Health endpoint ──────────────────────────────────────────────

describe('GET /health (US-005)', () => {
  it('returns 200 with status ok', async () => {
    const { status, body } = await api.get<{ status: string }>(`${baseUrl}/health`);
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

// ─── US-004 — Status endpoint ──────────────────────────────────────────────

describe('GET /status (US-004)', () => {
  it('returns 200 with ready status', async () => {
    const { status, body } = await api.get<{ status: string; version: string; color: string }>(
      `${baseUrl}/status`,
    );
    expect(status).toBe(200);
    expect(body.status).toBe('ready');
  });

  it('includes the canary brand colour #3a86ff', async () => {
    const { body } = await api.get<{ color: string }>(`${baseUrl}/status`);
    expect(body.color).toBe('#3a86ff');
  });
});

// ─── US-001 — Create todo ──────────────────────────────────────────────────

describe('POST /todos (US-001)', () => {
  it('creates a todo and returns 201', async () => {
    const { status, body } = await api.post<Todo>(`${baseUrl}/todos`, {
      title: 'Buy groceries',
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Buy groceries');
    expect(body.done).toBe(false);
    expect(body.createdAt).toBeTruthy();
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await api.post<{ error: string }>(`${baseUrl}/todos`, {});
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});

// ─── US-002 — Get todo ─────────────────────────────────────────────────────

describe('GET /todos/:id (US-002)', () => {
  it('retrieves an existing todo by id', async () => {
    const { body: created } = await api.post<Todo>(`${baseUrl}/todos`, {
      title: 'Walk the dog',
    });
    const { status, body } = await api.get<Todo>(`${baseUrl}/todos/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
    expect(body.title).toBe('Walk the dog');
  });

  it('returns 404 for an unknown id', async () => {
    const { status, body } = await api.get<{ error: string }>(
      `${baseUrl}/todos/does-not-exist`,
    );
    expect(status).toBe(404);
    expect(body.error).toBeTruthy();
  });
});

// ─── US-003 — List todos ───────────────────────────────────────────────────

describe('GET /todos (US-003)', () => {
  it('returns an array of todos', async () => {
    const { status, body } = await api.get<Todo[]>(`${baseUrl}/todos`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('includes todos that were created', async () => {
    await api.post<Todo>(`${baseUrl}/todos`, { title: 'Read a book' });
    const { body } = await api.get<Todo[]>(`${baseUrl}/todos`);
    expect(body.some((t) => t.title === 'Read a book')).toBe(true);
  });
});

// ─── US-003 — Lists grouped view ──────────────────────────────────────────

describe('GET /lists (US-003)', () => {
  it('returns pending and done arrays', async () => {
    const { status, body } = await api.get<{ pending: Todo[]; done: Todo[] }>(
      `${baseUrl}/lists`,
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.pending)).toBe(true);
    expect(Array.isArray(body.done)).toBe(true);
  });
});

// ─── US-006 — Toggle todo ──────────────────────────────────────────────────

describe('PATCH /todos/:id/toggle (US-006)', () => {
  it('toggles done from false to true', async () => {
    const { body: created } = await api.post<Todo>(`${baseUrl}/todos`, {
      title: 'Write tests',
    });
    expect(created.done).toBe(false);

    const { status, body: toggled } = await api.patch<Todo>(
      `${baseUrl}/todos/${created.id}/toggle`,
    );
    expect(status).toBe(200);
    expect(toggled.done).toBe(true);
  });

  it('toggles done from true back to false', async () => {
    const { body: created } = await api.post<Todo>(`${baseUrl}/todos`, {
      title: 'Check idempotency',
    });
    await api.patch<Todo>(`${baseUrl}/todos/${created.id}/toggle`);
    const { body: toggled } = await api.patch<Todo>(
      `${baseUrl}/todos/${created.id}/toggle`,
    );
    expect(toggled.done).toBe(false);
  });

  it('returns 404 for an unknown id', async () => {
    const { status, body } = await api.patch<{ error: string }>(
      `${baseUrl}/todos/ghost-id/toggle`,
    );
    expect(status).toBe(404);
    expect(body.error).toBeTruthy();
  });

  it('done todos appear in lists.done', async () => {
    const { body: created } = await api.post<Todo>(`${baseUrl}/todos`, {
      title: 'Finish project',
    });
    await api.patch<Todo>(`${baseUrl}/todos/${created.id}/toggle`);
    const { body: lists } = await api.get<{ pending: Todo[]; done: Todo[] }>(
      `${baseUrl}/lists`,
    );
    expect(lists.done.some((t) => t.id === created.id)).toBe(true);
  });
});
