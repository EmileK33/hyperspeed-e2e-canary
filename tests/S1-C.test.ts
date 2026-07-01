/**
 * S1-C independent test — store
 * Exercises src/store/todos.ts in isolation using a mock DbClient.
 * No network, no real Postgres required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setPool, resetPool } from '../src/db/pool.ts';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
} from '../src/store/todos.ts';
import type { Todo } from '../src/store/todos.ts';

// ---------------------------------------------------------------------------
// Minimal in-memory mock DB
// ---------------------------------------------------------------------------

interface MockRow {
  id: number;
  title: string;
  done: boolean;
  created_at: string;
}

function buildMockDb(initial: MockRow[] = []) {
  const rows: MockRow[] = [...initial];
  let nextId = (initial.reduce((m, r) => Math.max(m, r.id), 0)) + 1;

  return {
    rows,
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT INTO TODOS')) {
        const title = params?.[0] as string;
        const row: MockRow = { id: nextId++, title, done: false, created_at: new Date().toISOString() };
        rows.push(row);
        return { rows: [row] as unknown as T[] };
      }

      if (s.startsWith('SELECT') && s.includes('WHERE ID =')) {
        const id = params?.[0] as number;
        const found = rows.find(r => r.id === id);
        return { rows: (found ? [found] : []) as unknown as T[] };
      }

      if (s.startsWith('SELECT') && !s.includes('WHERE')) {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        return { rows: sorted as unknown as T[] };
      }

      if (s.startsWith('UPDATE TODOS SET DONE')) {
        const id = params?.[0] as number;
        const row = rows.find(r => r.id === id);
        if (!row) return { rows: [] };
        row.done = !row.done;
        return { rows: [row] as unknown as T[] };
      }

      return { rows: [] };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('src/store/todos.ts — exports', () => {
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

  it('Todo type is usable as a structural type', () => {
    const todo: Todo = { id: 1, title: 'test', done: false };
    expect(todo.id).toBe(1);
  });
});

describe('createTodo()', () => {
  beforeEach(() => resetPool());

  it('returns a todo with the given title', async () => {
    setPool(buildMockDb());
    const todo = await createTodo('Buy milk');
    expect(todo.title).toBe('Buy milk');
  });

  it('returns a todo with done = false', async () => {
    setPool(buildMockDb());
    const todo = await createTodo('Write tests');
    expect(todo.done).toBe(false);
  });

  it('returns a todo with a numeric id', async () => {
    setPool(buildMockDb());
    const todo = await createTodo('Ship it');
    expect(typeof todo.id).toBe('number');
  });

  it('assigns incrementing ids', async () => {
    const mock = buildMockDb();
    setPool(mock);
    const t1 = await createTodo('First');
    const t2 = await createTodo('Second');
    expect(t2.id).toBeGreaterThan(t1.id);
  });
});

describe('getTodo()', () => {
  beforeEach(() => resetPool());

  it('returns the todo when found', async () => {
    setPool(buildMockDb([{ id: 10, title: 'Existing', done: false, created_at: '2026-01-01' }]));
    const todo = await getTodo(10);
    expect(todo).toBeDefined();
    expect(todo!.title).toBe('Existing');
  });

  it('returns undefined when id does not exist', async () => {
    setPool(buildMockDb([]));
    const todo = await getTodo(999);
    expect(todo).toBeUndefined();
  });

  it('returned todo has correct id', async () => {
    setPool(buildMockDb([{ id: 5, title: 'Check id', done: true, created_at: '2026-01-01' }]));
    const todo = await getTodo(5);
    expect(todo!.id).toBe(5);
  });
});

describe('listTodos()', () => {
  beforeEach(() => resetPool());

  it('returns an array', async () => {
    setPool(buildMockDb());
    const list = await listTodos();
    expect(Array.isArray(list)).toBe(true);
  });

  it('returns empty array when no todos exist', async () => {
    setPool(buildMockDb());
    const list = await listTodos();
    expect(list).toHaveLength(0);
  });

  it('returns all seeded todos', async () => {
    const seed: MockRow[] = [
      { id: 1, title: 'A', done: false, created_at: '2026-01-01' },
      { id: 2, title: 'B', done: true,  created_at: '2026-01-02' },
    ];
    setPool(buildMockDb(seed));
    const list = await listTodos();
    expect(list).toHaveLength(2);
  });

  it('todos have the expected shape', async () => {
    const seed: MockRow[] = [{ id: 1, title: 'Shape check', done: false, created_at: '2026-01-01' }];
    setPool(buildMockDb(seed));
    const [todo] = await listTodos();
    expect(todo).toHaveProperty('id');
    expect(todo).toHaveProperty('title');
    expect(todo).toHaveProperty('done');
  });
});

describe('toggleTodo()', () => {
  beforeEach(() => resetPool());

  it('flips done from false to true', async () => {
    setPool(buildMockDb([{ id: 1, title: 'Toggle me', done: false, created_at: '2026-01-01' }]));
    const updated = await toggleTodo(1);
    expect(updated!.done).toBe(true);
  });

  it('flips done from true to false', async () => {
    setPool(buildMockDb([{ id: 2, title: 'Already done', done: true, created_at: '2026-01-01' }]));
    const updated = await toggleTodo(2);
    expect(updated!.done).toBe(false);
  });

  it('returns undefined when id does not exist', async () => {
    setPool(buildMockDb([]));
    const result = await toggleTodo(42);
    expect(result).toBeUndefined();
  });

  it('returns the updated todo with correct id', async () => {
    setPool(buildMockDb([{ id: 7, title: 'Check id', done: false, created_at: '2026-01-01' }]));
    const updated = await toggleTodo(7);
    expect(updated!.id).toBe(7);
  });
});
