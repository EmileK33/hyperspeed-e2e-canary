// tests/S1-B.test.ts — independent test for Session S1-B (store)
//
// Exercises src/store/todos.ts in complete isolation by injecting a fake pool
// via setPool().  No real Postgres connection is required.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Pool as PgPool, QueryResult } from 'pg';

import { setPool } from '../src/db/pool.js';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
  type Todo,
} from '../src/store/todos.js';

// ---------------------------------------------------------------------------
// Fake pool helpers
// ---------------------------------------------------------------------------

function makeFakePool(rows: Todo[]): PgPool {
  return {
    query: vi.fn().mockResolvedValue({ rows } as unknown as QueryResult),
  } as unknown as PgPool;
}

// ---------------------------------------------------------------------------
// Module shape
// ---------------------------------------------------------------------------

describe('S1-B: store exports', () => {
  it('createTodo is a function', () => {
    expect(typeof createTodo).toBe('function');
  });

  it('getTodo is a function', () => {
    expect(typeof getTodo).toBe('function');
  });

  it('listTodos is a function', () => {
    expect(typeof listTodos).toBe('function');
  });

  it('toggleTodo is a function', () => {
    expect(typeof toggleTodo).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// createTodo
// ---------------------------------------------------------------------------

describe('createTodo', () => {
  const fakeRow: Todo = { id: 1, title: 'Buy milk', done: false, created_at: '2026-01-01T00:00:00Z' };

  beforeEach(() => {
    setPool(makeFakePool([fakeRow]));
  });

  afterEach(() => {
    setPool(null);
  });

  it('returns the created todo row', async () => {
    const todo = await createTodo('Buy milk');
    expect(todo).toEqual(fakeRow);
  });

  it('returned todo has id, title, done fields', async () => {
    const todo = await createTodo('Buy milk');
    expect(typeof todo.id).toBe('number');
    expect(typeof todo.title).toBe('string');
    expect(typeof todo.done).toBe('boolean');
  });

  it('passes the title to the query', async () => {
    const pool = makeFakePool([fakeRow]);
    setPool(pool);
    await createTodo('Buy milk');
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain('Buy milk');
  });
});

// ---------------------------------------------------------------------------
// getTodo
// ---------------------------------------------------------------------------

describe('getTodo', () => {
  afterEach(() => {
    setPool(null);
  });

  it('returns the todo when a row is found', async () => {
    const fakeRow: Todo = { id: 42, title: 'Walk dog', done: true };
    setPool(makeFakePool([fakeRow]));
    const todo = await getTodo(42);
    expect(todo).toEqual(fakeRow);
  });

  it('returns null when no row is found', async () => {
    setPool(makeFakePool([]));
    const todo = await getTodo(999);
    expect(todo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listTodos
// ---------------------------------------------------------------------------

describe('listTodos', () => {
  afterEach(() => {
    setPool(null);
  });

  it('returns an array of todos', async () => {
    const fakeRows: Todo[] = [
      { id: 1, title: 'A', done: false },
      { id: 2, title: 'B', done: true },
    ];
    setPool(makeFakePool(fakeRows));
    const todos = await listTodos();
    expect(todos).toEqual(fakeRows);
    expect(Array.isArray(todos)).toBe(true);
  });

  it('returns an empty array when no todos exist', async () => {
    setPool(makeFakePool([]));
    const todos = await listTodos();
    expect(todos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toggleTodo
// ---------------------------------------------------------------------------

describe('toggleTodo', () => {
  afterEach(() => {
    setPool(null);
  });

  it('returns the updated todo after toggling', async () => {
    const fakeRow: Todo = { id: 5, title: 'Test', done: true };
    setPool(makeFakePool([fakeRow]));
    const todo = await toggleTodo(5);
    expect(todo).toEqual(fakeRow);
  });

  it('returns null when the todo does not exist', async () => {
    setPool(makeFakePool([]));
    const todo = await toggleTodo(9999);
    expect(todo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Todo type shape
// ---------------------------------------------------------------------------

describe('Todo type', () => {
  it('Todo type has the correct shape', () => {
    const todo: Todo = { id: 1, title: 'Test', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Test');
    expect(todo.done).toBe(false);
  });

  it('Todo type supports optional created_at', () => {
    const todo: Todo = { id: 1, title: 'Test', done: false, created_at: '2026-01-01T00:00:00Z' };
    expect(todo.created_at).toBe('2026-01-01T00:00:00Z');
  });
});
