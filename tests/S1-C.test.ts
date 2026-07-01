/**
 * S1-C independent tests — src/store/todos.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { setPool, closePool } from '../src/db/pool.ts';
import type { Pool, QueryResult } from '../src/db/pool.ts';

import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
} from '../src/store/todos.ts';
import type { Todo } from '../src/store/todos.ts';

const ISO = '2026-07-01T00:00:00.000Z';

function makeRow(overrides: Partial<{ id: number; title: string; done: boolean; list_id: number | null; created_at: string | Date }> = {}): { id: number; title: string; done: boolean; list_id: number | null; created_at: string } {
  return { id: 1, title: 'Test todo', done: false, list_id: null, created_at: ISO, ...overrides };
}

function mockPool(rows: Record<string, unknown>[]): Pool {
  return {
    async query<T = Record<string, unknown>>(_sql: string, _params?: unknown[]): Promise<QueryResult<T>> {
      return { rows: rows as T[], rowCount: rows.length };
    },
    async connect() {
      return {
        query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [] as T[], rowCount: 0 }),
        release: () => {},
      };
    },
    async end() {},
  };
}

function spyPool(rows: Record<string, unknown>[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool: Pool = {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      calls.push({ sql, params: params ?? [] });
      return { rows: rows as T[], rowCount: rows.length };
    },
    async connect() {
      return {
        query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({ rows: [] as T[], rowCount: 0 }),
        release: () => {},
      };
    },
    async end() {},
  };
  return { pool, calls };
}

afterEach(async () => {
  await closePool();
});

describe('Todo type', () => {
  it('has the expected shape', () => {
    const todo: Todo = { id: 1, title: 'Write tests', done: false, list_id: null, created_at: ISO };
    expect(todo.id).toBe(1);
    expect(todo.done).toBe(false);
    expect(todo.list_id).toBeNull();
  });

  it('allows list_id to be a number', () => {
    const todo: Todo = { id: 2, title: 'Buy milk', done: true, list_id: 3, created_at: ISO };
    expect(todo.list_id).toBe(3);
  });
});

describe('createTodo', () => {
  it('returns a Todo with correct fields', async () => {
    const row = makeRow({ id: 42, title: 'Hello', done: false, list_id: null });
    setPool(mockPool([row]));
    const todo = await createTodo('Hello');
    expect(todo.id).toBe(42);
    expect(todo.title).toBe('Hello');
    expect(todo.done).toBe(false);
    expect(todo.list_id).toBeNull();
    expect(todo.created_at).toBe(ISO);
  });

  it('sends an INSERT query with RETURNING', async () => {
    const row = makeRow({ id: 1, title: 'Task' });
    const { pool, calls } = spyPool([row]);
    setPool(pool);
    await createTodo('Task');
    expect(calls.length).toBe(1);
    const sql = calls[0]!.sql.toUpperCase();
    expect(sql).toContain('INSERT');
    expect(sql).toContain('TODOS');
    expect(sql).toContain('RETURNING');
  });

  it('passes title and list_id as query params', async () => {
    const row = makeRow({ id: 5, title: 'Grouped', list_id: 7 });
    const { pool, calls } = spyPool([row]);
    setPool(pool);
    await createTodo('Grouped', 7);
    expect(calls[0]!.params).toEqual(['Grouped', 7]);
  });

  it('uses null for list_id when not provided', async () => {
    const row = makeRow({ id: 2, title: 'Solo' });
    const { pool, calls } = spyPool([row]);
    setPool(pool);
    await createTodo('Solo');
    expect(calls[0]!.params[1]).toBeNull();
  });

  it('throws when pool returns no rows', async () => {
    setPool(mockPool([]));
    await expect(createTodo('Ghost')).rejects.toThrow();
  });

  it('converts Date created_at to ISO string', async () => {
    const row = { ...makeRow(), created_at: new Date(ISO) };
    setPool(mockPool([row]));
    const todo = await createTodo('DateTest');
    expect(todo.created_at).toBe(ISO);
  });
});

describe('getTodo', () => {
  it('returns a Todo when a row exists', async () => {
    const row = makeRow({ id: 10, title: 'Fetch me' });
    setPool(mockPool([row]));
    const todo = await getTodo(10);
    expect(todo).not.toBeNull();
    expect(todo!.id).toBe(10);
    expect(todo!.title).toBe('Fetch me');
  });

  it('returns null when no row found', async () => {
    setPool(mockPool([]));
    const todo = await getTodo(999);
    expect(todo).toBeNull();
  });

  it('sends a SELECT query with WHERE', async () => {
    const { pool, calls } = spyPool([makeRow({ id: 7 })]);
    setPool(pool);
    await getTodo(7);
    const sql = calls[0]!.sql.toUpperCase();
    expect(sql).toContain('SELECT');
    expect(sql).toContain('TODOS');
    expect(calls[0]!.params).toEqual([7]);
  });
});

describe('listTodos', () => {
  it('returns an empty array when no todos', async () => {
    setPool(mockPool([]));
    const todos = await listTodos();
    expect(todos).toEqual([]);
  });

  it('returns all rows as Todo objects', async () => {
    const rows = [
      makeRow({ id: 3, title: 'C', done: true }),
      makeRow({ id: 1, title: 'A', done: false }),
    ];
    setPool(mockPool(rows));
    const todos = await listTodos();
    expect(todos).toHaveLength(2);
    expect(todos[0]!.id).toBe(3);
    expect(todos[1]!.id).toBe(1);
  });

  it('sends a SELECT query against todos table', async () => {
    const { pool, calls } = spyPool([]);
    setPool(pool);
    await listTodos();
    const sql = calls[0]!.sql.toUpperCase();
    expect(sql).toContain('SELECT');
    expect(sql).toContain('TODOS');
  });
});

describe('toggleTodo', () => {
  it('returns updated Todo', async () => {
    const row = makeRow({ id: 4, title: 'Toggle me', done: true });
    setPool(mockPool([row]));
    const todo = await toggleTodo(4);
    expect(todo).not.toBeNull();
    expect(todo!.done).toBe(true);
    expect(todo!.id).toBe(4);
  });

  it('returns null when id not found', async () => {
    setPool(mockPool([]));
    const todo = await toggleTodo(999);
    expect(todo).toBeNull();
  });

  it('sends an UPDATE with SET done = NOT done and RETURNING', async () => {
    const row = makeRow({ id: 5, done: false });
    const { pool, calls } = spyPool([row]);
    setPool(pool);
    await toggleTodo(5);
    const sql = calls[0]!.sql.toUpperCase();
    expect(sql).toContain('UPDATE');
    expect(sql).toContain('TODOS');
    expect(sql).toContain('DONE');
    expect(sql).toContain('RETURNING');
    expect(calls[0]!.params).toEqual([5]);
  });
});
