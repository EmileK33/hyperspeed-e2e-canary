/**
 * S1-B independent test — Todo store
 *
 * Tests are purely in-memory: a mock Pool is injected via _setPool() so
 * no real Postgres connection is required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { _setPool } from '../src/db/pool.ts';
import type { Pool, QueryResult } from '../src/db/pool.ts';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
} from '../src/store/todos.ts';
import type { Todo } from '../src/store/todos.ts';

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

function makePool(rows: Record<string, unknown>[]): Pool {
  return {
    query: async (_text: string, _values?: unknown[]) =>
      ({ rows, rowCount: rows.length } as unknown as QueryResult<never>),
    end: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => _setPool(null));
afterEach(() => _setPool(null));

// ---------------------------------------------------------------------------
// Type export
// ---------------------------------------------------------------------------

describe('Todo type', () => {
  it('is usable as a plain TypeScript object', () => {
    const todo: Todo = { id: 1, title: 'Buy milk', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTodo
// ---------------------------------------------------------------------------

describe('createTodo', () => {
  it('returns the inserted row', async () => {
    const fakeRow = { id: 1, title: 'Write tests', done: false };
    _setPool(makePool([fakeRow]));

    const todo = await createTodo('Write tests');
    expect(todo).toEqual({ id: 1, title: 'Write tests', done: false });
  });

  it('passes the title as a query parameter', async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const fakePool: Pool = {
      query: async (text: string, values?: unknown[]) => {
        calls.push({ text, values: values ?? [] });
        return {
          rows: [{ id: 42, title: values?.[0], done: false }],
          rowCount: 1,
        } as unknown as QueryResult<never>;
      },
      end: async () => {},
    };
    _setPool(fakePool);

    const todo = await createTodo('My task');
    expect(calls[0].values[0]).toBe('My task');
    expect(todo.id).toBe(42);
    expect(todo.title).toBe('My task');
  });
});

// ---------------------------------------------------------------------------
// getTodo
// ---------------------------------------------------------------------------

describe('getTodo', () => {
  it('returns the matching todo', async () => {
    const fakeRow = { id: 5, title: 'Ship it', done: true };
    _setPool(makePool([fakeRow]));

    const todo = await getTodo(5);
    expect(todo).toEqual({ id: 5, title: 'Ship it', done: true });
  });

  it('returns null when no row is found', async () => {
    _setPool(makePool([]));
    const todo = await getTodo(999);
    expect(todo).toBeNull();
  });

  it('passes the id as a query parameter', async () => {
    const calls: Array<{ values: unknown[] }> = [];
    const fakePool: Pool = {
      query: async (_text: string, values?: unknown[]) => {
        calls.push({ values: values ?? [] });
        return {
          rows: [{ id: 7, title: 'x', done: false }],
          rowCount: 1,
        } as unknown as QueryResult<never>;
      },
      end: async () => {},
    };
    _setPool(fakePool);

    await getTodo(7);
    expect(calls[0].values[0]).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// listTodos
// ---------------------------------------------------------------------------

describe('listTodos', () => {
  it('returns all rows as Todo objects', async () => {
    const fakeRows = [
      { id: 1, title: 'Alpha', done: false },
      { id: 2, title: 'Beta', done: true },
    ];
    _setPool(makePool(fakeRows));

    const todos = await listTodos();
    expect(todos).toHaveLength(2);
    expect(todos[0]).toEqual({ id: 1, title: 'Alpha', done: false });
    expect(todos[1]).toEqual({ id: 2, title: 'Beta', done: true });
  });

  it('returns an empty array when there are no todos', async () => {
    _setPool(makePool([]));
    const todos = await listTodos();
    expect(todos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toggleTodo
// ---------------------------------------------------------------------------

describe('toggleTodo', () => {
  it('returns the updated todo with flipped done flag', async () => {
    const fakeRow = { id: 3, title: 'Deploy', done: true };
    _setPool(makePool([fakeRow]));

    const todo = await toggleTodo(3);
    expect(todo).toEqual({ id: 3, title: 'Deploy', done: true });
  });

  it('returns null when no row is updated', async () => {
    _setPool(makePool([]));
    const todo = await toggleTodo(999);
    expect(todo).toBeNull();
  });

  it('passes the id as a query parameter', async () => {
    const calls: Array<{ values: unknown[] }> = [];
    const fakePool: Pool = {
      query: async (_text: string, values?: unknown[]) => {
        calls.push({ values: values ?? [] });
        return {
          rows: [{ id: 10, title: 'Check', done: true }],
          rowCount: 1,
        } as unknown as QueryResult<never>;
      },
      end: async () => {},
    };
    _setPool(fakePool);

    await toggleTodo(10);
    expect(calls[0].values[0]).toBe(10);
  });
});
