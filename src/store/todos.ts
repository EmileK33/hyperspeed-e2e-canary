/**
 * Todo store — thin typed wrapper over the Postgres query helper.
 *
 * Exports: Todo, createTodo, getTodo, listTodos, toggleTodo
 */

import { query } from '../db/pool.ts';

// ---------------------------------------------------------------------------
// Domain type (re-exported for consumers that import from this module)
// ---------------------------------------------------------------------------

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Store operations
// ---------------------------------------------------------------------------

/**
 * Insert a new todo row and return the created record.
 */
export async function createTodo(title: string): Promise<Todo> {
  const result = await query<{ id: number; title: string; done: boolean }>(
    'INSERT INTO todos (title, done) VALUES ($1, false) RETURNING id, title, done',
    [title],
  );
  const row = result.rows[0];
  return { id: row.id, title: row.title, done: row.done };
}

/**
 * Fetch a single todo by id. Returns `null` if not found.
 */
export async function getTodo(id: number): Promise<Todo | null> {
  const result = await query<{ id: number; title: string; done: boolean }>(
    'SELECT id, title, done FROM todos WHERE id = $1',
    [id],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, title: row.title, done: row.done };
}

/**
 * Return all todos ordered by id ascending.
 */
export async function listTodos(): Promise<Todo[]> {
  const result = await query<{ id: number; title: string; done: boolean }>(
    'SELECT id, title, done FROM todos ORDER BY id ASC',
  );
  return result.rows.map((row) => ({ id: row.id, title: row.title, done: row.done }));
}

/**
 * Flip the `done` flag for the given todo and return the updated record.
 * Returns `null` if no todo with that id exists.
 */
export async function toggleTodo(id: number): Promise<Todo | null> {
  const result = await query<{ id: number; title: string; done: boolean }>(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done',
    [id],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, title: row.title, done: row.done };
}
