// Independent test for Session S1-B — todo store.
// Exercises src/store/todos.ts in isolation using a stub pool (no real DB).
// Run: npm run test -- tests/S1-B.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stub pool factory
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeStubPool(rows: any[] = [], rowCount = rows.length) {
  return {
    // typed as any so the generic Pool<T> constraint is satisfied by the stub
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: vi.fn(async () => ({ rows, rowCount })) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
    end: async () => {},
  };
}

type StubPool = ReturnType<typeof makeStubPool>;

// ---------------------------------------------------------------------------
// Helpers: reset module registry + inject stub pool before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
});

async function withPool(pool: StubPool) {
  const { setPool } = await import('../src/db/pool.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPool(pool as any);
  return import('../src/store/todos.js');
}

// ---------------------------------------------------------------------------
// Type export
// ---------------------------------------------------------------------------

describe('Todo type export', () => {
  it('module exports Todo as a named export (runtime check via module keys)', async () => {
    const mod = await import('../src/store/todos.js');
    // TypeScript types disappear at runtime; we just verify the module loads
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// createTodo
// ---------------------------------------------------------------------------

describe('createTodo', () => {
  it('calls INSERT with title and list_id, returns first row', async () => {
    const createdRow = { id: 1, title: 'Buy milk', done: false, list_id: null, created_at: '2026-01-01' };
    const pool = makeStubPool([createdRow]);
    const { createTodo } = await withPool(pool);

    const result = await createTodo('Buy milk');

    expect(pool.query).toHaveBeenCalledOnce();
    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO todos/i);
    expect(params[0]).toBe('Buy milk');
    expect(params[1]).toBeNull();
    expect(result).toEqual(createdRow);
  });

  it('passes list_id when provided', async () => {
    const createdRow = { id: 2, title: 'Task', done: false, list_id: 5, created_at: '2026-01-01' };
    const pool = makeStubPool([createdRow]);
    const { createTodo } = await withPool(pool);

    const result = await createTodo('Task', 5);

    const [, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params[1]).toBe(5);
    expect(result.list_id).toBe(5);
  });

  it('returns the inserted todo with done=false', async () => {
    const pool = makeStubPool([{ id: 3, title: 'Test', done: false, list_id: null }]);
    const { createTodo } = await withPool(pool);
    const todo = await createTodo('Test');
    expect(todo.done).toBe(false);
    expect(todo.title).toBe('Test');
  });
});

// ---------------------------------------------------------------------------
// getTodo
// ---------------------------------------------------------------------------

describe('getTodo', () => {
  it('queries by id and returns the matching row', async () => {
    const row = { id: 7, title: 'Read docs', done: true, list_id: null };
    const pool = makeStubPool([row]);
    const { getTodo } = await withPool(pool);

    const result = await getTodo(7);

    expect(pool.query).toHaveBeenCalledOnce();
    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/SELECT/i);
    expect(sql).toMatch(/WHERE/i);
    expect(params[0]).toBe(7);
    expect(result).toEqual(row);
  });

  it('returns undefined when no row found', async () => {
    const pool = makeStubPool([]);
    const { getTodo } = await withPool(pool);
    const result = await getTodo(999);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listTodos
// ---------------------------------------------------------------------------

describe('listTodos', () => {
  it('returns all rows from the query', async () => {
    const rows = [
      { id: 1, title: 'Alpha', done: false, list_id: null },
      { id: 2, title: 'Beta', done: true, list_id: null },
    ];
    const pool = makeStubPool(rows);
    const { listTodos } = await withPool(pool);

    const result = await listTodos();

    expect(pool.query).toHaveBeenCalledOnce();
    const [sql] = pool.query.mock.calls[0] as unknown as [string];
    expect(sql).toMatch(/SELECT/i);
    expect(sql).toMatch(/todos/i);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Alpha');
    expect(result[1].title).toBe('Beta');
  });

  it('returns an empty array when no todos exist', async () => {
    const pool = makeStubPool([]);
    const { listTodos } = await withPool(pool);
    const result = await listTodos();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toggleTodo
// ---------------------------------------------------------------------------

describe('toggleTodo', () => {
  it('issues an UPDATE that flips done and returns updated row', async () => {
    const updatedRow = { id: 4, title: 'Write tests', done: true, list_id: null };
    const pool = makeStubPool([updatedRow]);
    const { toggleTodo } = await withPool(pool);

    const result = await toggleTodo(4);

    expect(pool.query).toHaveBeenCalledOnce();
    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/UPDATE todos/i);
    expect(sql).toMatch(/NOT done/i);
    expect(params[0]).toBe(4);
    expect(result).toEqual(updatedRow);
  });

  it('returns undefined when no row with that id exists', async () => {
    const pool = makeStubPool([]);
    const { toggleTodo } = await withPool(pool);
    const result = await toggleTodo(999);
    expect(result).toBeUndefined();
  });

  it('returned todo reflects the new done value', async () => {
    const pool = makeStubPool([{ id: 5, title: 'Deploy', done: true, list_id: null }]);
    const { toggleTodo } = await withPool(pool);
    const todo = await toggleTodo(5);
    expect(todo?.done).toBe(true); // stub returns whatever we set
  });
});

// ---------------------------------------------------------------------------
// All exports present
// ---------------------------------------------------------------------------

describe('module exports', () => {
  it('exports createTodo, getTodo, listTodos, toggleTodo as functions', async () => {
    const mod = await import('../src/store/todos.js');
    expect(typeof mod.createTodo).toBe('function');
    expect(typeof mod.getTodo).toBe('function');
    expect(typeof mod.listTodos).toBe('function');
    expect(typeof mod.toggleTodo).toBe('function');
  });
});
