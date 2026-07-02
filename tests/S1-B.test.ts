/**
 * Independent tests for S1-B: todo store (src/store/todos.ts).
 *
 * All tests use an injected fake pool so no real database is required.
 * The fake pool simulates a minimal in-memory todos table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPool, closePool } from '../src/db/pool.js';
import type { DbPool, QueryResult } from '../src/db/pool.js';

import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
  type Todo,
} from '../src/store/todos.js';

// ── Fake in-memory pool ───────────────────────────────────────────────────────

function makeFakePool(): DbPool {
  // Simple in-memory store that replicates the four SQL queries used by the store.
  let nextId = 1;
  const rows: Todo[] = [];

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const s = sql.trim().toUpperCase();

      // INSERT INTO todos
      if (s.startsWith('INSERT INTO TODOS')) {
        const title = params?.[0] as string;
        const row: Todo = { id: nextId++, title, done: false };
        rows.push(row);
        return { rows: [row] as unknown as T[], rowCount: 1 };
      }

      // SELECT … WHERE id = $1
      if (s.startsWith('SELECT') && s.includes('WHERE ID')) {
        const id = params?.[0] as number;
        const found = rows.find((r) => r.id === id);
        return { rows: (found ? [found] : []) as unknown as T[], rowCount: found ? 1 : 0 };
      }

      // SELECT all
      if (s.startsWith('SELECT')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as T[], rowCount: sorted.length };
      }

      // UPDATE todos SET done = NOT done WHERE id = $1
      if (s.startsWith('UPDATE TODOS')) {
        const id = params?.[0] as number;
        const row = rows.find((r) => r.id === id);
        if (!row) return { rows: [] as unknown as T[], rowCount: 0 };
        row.done = !row.done;
        return { rows: [row] as unknown as T[], rowCount: 1 };
      }

      return { rows: [] as unknown as T[], rowCount: 0 };
    },
    async end() {},
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  setPool(makeFakePool());
});

afterEach(async () => {
  await closePool();
});

// ── Type shape ────────────────────────────────────────────────────────────────

describe('Todo type', () => {
  it('has id, title, done fields', () => {
    const t: Todo = { id: 1, title: 'Buy milk', done: false };
    expect(t.id).toBe(1);
    expect(t.title).toBe('Buy milk');
    expect(t.done).toBe(false);
  });
});

// ── createTodo ────────────────────────────────────────────────────────────────

describe('createTodo', () => {
  it('returns a todo with the given title', async () => {
    const todo = await createTodo('Write tests');
    expect(todo.title).toBe('Write tests');
  });

  it('returns done: false', async () => {
    const todo = await createTodo('New task');
    expect(todo.done).toBe(false);
  });

  it('assigns a numeric id', async () => {
    const todo = await createTodo('Another task');
    expect(typeof todo.id).toBe('number');
  });

  it('assigns incrementing ids', async () => {
    const a = await createTodo('Task A');
    const b = await createTodo('Task B');
    expect(b.id).toBeGreaterThan(a.id);
  });
});

// ── getTodo ───────────────────────────────────────────────────────────────────

describe('getTodo', () => {
  it('retrieves an existing todo by id', async () => {
    const created = await createTodo('Find me');
    const found = await getTodo(created.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Find me');
    expect(found?.id).toBe(created.id);
  });

  it('returns undefined for non-existent id', async () => {
    const result = await getTodo(9999);
    expect(result).toBeUndefined();
  });
});

// ── listTodos ─────────────────────────────────────────────────────────────────

describe('listTodos', () => {
  it('returns an empty array when no todos exist', async () => {
    const list = await listTodos();
    expect(list).toEqual([]);
  });

  it('returns all created todos', async () => {
    await createTodo('Alpha');
    await createTodo('Beta');
    const list = await listTodos();
    expect(list).toHaveLength(2);
  });

  it('returns todos ordered by id ascending', async () => {
    await createTodo('First');
    await createTodo('Second');
    await createTodo('Third');
    const list = await listTodos();
    expect(list[0]?.title).toBe('First');
    expect(list[1]?.title).toBe('Second');
    expect(list[2]?.title).toBe('Third');
  });

  it('returns Todo-shaped objects', async () => {
    await createTodo('Check shape');
    const [item] = await listTodos();
    expect(item).toMatchObject({ id: expect.any(Number), title: 'Check shape', done: false });
  });
});

// ── toggleTodo ────────────────────────────────────────────────────────────────

describe('toggleTodo', () => {
  it('flips done from false to true', async () => {
    const created = await createTodo('Toggle me');
    expect(created.done).toBe(false);
    const toggled = await toggleTodo(created.id);
    expect(toggled.done).toBe(true);
  });

  it('flips done from true to false', async () => {
    const created = await createTodo('Toggle twice');
    await toggleTodo(created.id);
    const toggled = await toggleTodo(created.id);
    expect(toggled.done).toBe(false);
  });

  it('returns the updated todo with correct id and title', async () => {
    const created = await createTodo('My todo');
    const toggled = await toggleTodo(created.id);
    expect(toggled.id).toBe(created.id);
    expect(toggled.title).toBe('My todo');
  });

  it('throws for non-existent id', async () => {
    await expect(toggleTodo(9999)).rejects.toThrow();
  });

  it('persists the toggle (listTodos reflects change)', async () => {
    const created = await createTodo('Persistent toggle');
    await toggleTodo(created.id);
    const list = await listTodos();
    const found = list.find((t) => t.id === created.id);
    expect(found?.done).toBe(true);
  });
});
