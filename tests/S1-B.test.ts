/**
 * S1-B independent test — todo store
 *
 * Uses the mock-pool injection from `src/db/pool.ts` (`_setPool`) so no real
 * Postgres instance is required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { _setPool } from '../src/db/pool.ts';
import type { Pool, QueryResult, Row } from '../src/db/pool.ts';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
} from '../src/store/todos.ts';
import type { Todo } from '../src/store/todos.ts';

// ---------------------------------------------------------------------------
// Helpers — simple in-memory store to simulate Postgres
// ---------------------------------------------------------------------------

interface TodoRow extends Row {
  id: number;
  title: string;
  done: boolean;
}

function createMockPool() {
  const rows: TodoRow[] = [];
  let nextId = 1;

  const pool: Pool = {
    query: async <R extends Row = Row>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>> => {
      const sql = text.trim().toUpperCase();

      // INSERT INTO todos
      if (sql.startsWith('INSERT INTO TODOS')) {
        const title = values?.[0] as string;
        const row: TodoRow = { id: nextId++, title, done: false };
        rows.push(row);
        return { rows: [row] as unknown as R[], rowCount: 1 };
      }

      // SELECT … WHERE id = $1
      if (sql.startsWith('SELECT') && sql.includes('WHERE ID = $1')) {
        const id = Number(values?.[0]);
        const found = rows.find((r) => r.id === id);
        return {
          rows: found ? ([found] as unknown as R[]) : [],
          rowCount: found ? 1 : 0,
        };
      }

      // SELECT all
      if (sql.startsWith('SELECT')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as R[], rowCount: sorted.length };
      }

      // UPDATE todos SET done = NOT done WHERE id = $1
      if (sql.startsWith('UPDATE TODOS')) {
        const id = Number(values?.[0]);
        const row = rows.find((r) => r.id === id);
        if (!row) return { rows: [], rowCount: 0 };
        row.done = !row.done;
        return { rows: [row] as unknown as R[], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };

  return pool;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('src/store/todos.ts', () => {
  beforeEach(() => {
    _setPool(createMockPool());
  });

  afterEach(() => {
    _setPool(null);
  });

  // ---- exports ----

  it('exports createTodo as a function', () => {
    expect(typeof createTodo).toBe('function');
  });

  it('exports getTodo as a function', () => {
    expect(typeof getTodo).toBe('function');
  });

  it('exports listTodos as a function', () => {
    expect(typeof listTodos).toBe('function');
  });

  it('exports toggleTodo as a function', () => {
    expect(typeof toggleTodo).toBe('function');
  });

  // ---- createTodo ----

  it('createTodo returns a Todo with the given title and done=false', async () => {
    const todo = await createTodo('Buy milk');
    expect(todo.id).toBeGreaterThan(0);
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
  });

  it('createTodo returns incrementing ids for successive inserts', async () => {
    const a = await createTodo('First');
    const b = await createTodo('Second');
    expect(b.id).toBeGreaterThan(a.id);
  });

  // ---- getTodo ----

  it('getTodo returns the matching todo', async () => {
    const created = await createTodo('Test item');
    const fetched = await getTodo(created.id);
    expect(fetched).toEqual(created);
  });

  it('getTodo returns null for a non-existent id', async () => {
    const result = await getTodo(9999);
    expect(result).toBeNull();
  });

  // ---- listTodos ----

  it('listTodos returns an empty array when no todos exist', async () => {
    const list = await listTodos();
    expect(list).toEqual([]);
  });

  it('listTodos returns all created todos in order', async () => {
    const a = await createTodo('Alpha');
    const b = await createTodo('Beta');
    const c = await createTodo('Gamma');
    const list = await listTodos();
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual(a);
    expect(list[1]).toEqual(b);
    expect(list[2]).toEqual(c);
  });

  // ---- toggleTodo ----

  it('toggleTodo flips done from false to true', async () => {
    const todo = await createTodo('Flip me');
    expect(todo.done).toBe(false);
    const toggled = await toggleTodo(todo.id);
    expect(toggled?.done).toBe(true);
  });

  it('toggleTodo flips done back to false on second call', async () => {
    const todo = await createTodo('Flip twice');
    await toggleTodo(todo.id);
    const toggled = await toggleTodo(todo.id);
    expect(toggled?.done).toBe(false);
  });

  it('toggleTodo returns null for a non-existent id', async () => {
    const result = await toggleTodo(9999);
    expect(result).toBeNull();
  });

  it('toggleTodo does not affect other todos', async () => {
    const a = await createTodo('Stay false');
    const b = await createTodo('Get toggled');
    await toggleTodo(b.id);
    const checkA = await getTodo(a.id);
    expect(checkA?.done).toBe(false);
  });

  // ---- Todo type structural check ----

  it('Todo type has id, title, done shape', async () => {
    const todo: Todo = await createTodo('Type check');
    // TypeScript ensures shape at compile time; runtime check for completeness
    expect(typeof todo.id).toBe('number');
    expect(typeof todo.title).toBe('string');
    expect(typeof todo.done).toBe('boolean');
  });
});
