/**
 * S1-B — store/todos.ts
 * Tests run against a fake in-memory pool (no live DB required).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPool, resetPool } from '../src/db/pool.ts';
import type { DbPool } from '../src/db/pool.ts';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
} from '../src/store/todos.ts';
import type { Todo } from '../src/store/todos.ts';

// ---------------------------------------------------------------------------
// In-memory fake pool
// ---------------------------------------------------------------------------

let nextId = 1;
let rows: Todo[] = [];

function buildFakePool(): DbPool {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.trim().toUpperCase();

      // INSERT INTO todos
      if (s.startsWith('INSERT INTO TODOS')) {
        const title = (params as [string])[0];
        const todo: Todo = {
          id: nextId++,
          title,
          done: false,
          created_at: new Date().toISOString(),
        };
        rows.push(todo);
        return { rows: [{ ...todo }], rowCount: 1 };
      }

      // SELECT single row
      if (s.startsWith('SELECT') && s.includes('WHERE ID =')) {
        const id = (params as [number])[0];
        const found = rows.find((r) => r.id === id);
        return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
      }

      // SELECT all todos
      if (s.startsWith('SELECT') && !s.includes('WHERE')) {
        return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
      }

      // UPDATE todos SET done = NOT done
      if (s.startsWith('UPDATE TODOS')) {
        const id = (params as [number])[0];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx === -1) return { rows: [], rowCount: 0 };
        rows[idx] = { ...rows[idx], done: !rows[idx].done };
        return { rows: [{ ...rows[idx] }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }) as DbPool['query'],
    end: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetPool();
  nextId = 1;
  rows = [];
  setPool(buildFakePool());
});

// ---------------------------------------------------------------------------
// createTodo
// ---------------------------------------------------------------------------

describe('createTodo', () => {
  it('returns a Todo with the given title', async () => {
    const todo = await createTodo('Buy milk');
    expect(todo.title).toBe('Buy milk');
    expect(todo.done).toBe(false);
    expect(typeof todo.id).toBe('number');
  });

  it('assigns incrementing ids', async () => {
    const a = await createTodo('first');
    const b = await createTodo('second');
    expect(b.id).toBeGreaterThan(a.id);
  });
});

// ---------------------------------------------------------------------------
// getTodo
// ---------------------------------------------------------------------------

describe('getTodo', () => {
  it('returns the todo when it exists', async () => {
    const created = await createTodo('Read docs');
    const found = await getTodo(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe('Read docs');
  });

  it('returns undefined when id does not exist', async () => {
    const result = await getTodo(9999);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listTodos
// ---------------------------------------------------------------------------

describe('listTodos', () => {
  it('returns an empty array when no todos exist', async () => {
    const list = await listTodos();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('returns all created todos', async () => {
    await createTodo('Alpha');
    await createTodo('Beta');
    const list = await listTodos();
    expect(list.length).toBe(2);
    const titles = list.map((t) => t.title);
    expect(titles).toContain('Alpha');
    expect(titles).toContain('Beta');
  });
});

// ---------------------------------------------------------------------------
// toggleTodo
// ---------------------------------------------------------------------------

describe('toggleTodo', () => {
  it('flips done from false to true', async () => {
    const created = await createTodo('Write tests');
    expect(created.done).toBe(false);
    const toggled = await toggleTodo(created.id);
    expect(toggled?.done).toBe(true);
  });

  it('flips done from true back to false', async () => {
    const created = await createTodo('Double flip');
    await toggleTodo(created.id);   // false → true
    const toggled = await toggleTodo(created.id); // true → false
    expect(toggled?.done).toBe(false);
  });

  it('returns undefined for non-existent id', async () => {
    const result = await toggleTodo(9999);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Todo type — structural check
// ---------------------------------------------------------------------------

describe('Todo type', () => {
  it('is structurally { id, title, done }', async () => {
    const todo: Todo = { id: 1, title: 'test', done: false };
    expect(todo.id).toBe(1);
    expect(todo.title).toBe('test');
    expect(todo.done).toBe(false);
  });
});
