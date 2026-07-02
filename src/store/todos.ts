/**
 * Todo store — Postgres-backed CRUD helpers.
 *
 * Exports typed functions for creating, reading, listing, and toggling todos.
 * All queries go through the shared pool in `src/db/pool.ts` so callers never
 * embed SQL and tests can inject a mock pool via `_setPool`.
 */

import { query } from '../db/pool.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single todo item as stored in Postgres and returned to callers. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Store functions
// ---------------------------------------------------------------------------

/**
 * Insert a new todo row and return the created record.
 * @param title  Non-empty title string.
 */
export async function createTodo(title: string): Promise<Todo> {
  const result = await query(
    'INSERT INTO todos (title, done) VALUES ($1, false) RETURNING id, title, done',
    [title],
  );
  const row = result.rows[0] as unknown as Todo | undefined;
  if (!row) {
    throw new Error('createTodo: no row returned after INSERT');
  }
  return row;
}

/**
 * Fetch a single todo by primary key.
 * Returns `null` when no matching row exists.
 */
export async function getTodo(id: number): Promise<Todo | null> {
  const result = await query(
    'SELECT id, title, done FROM todos WHERE id = $1',
    [id],
  );
  return (result.rows[0] as unknown as Todo | undefined) ?? null;
}

/**
 * Return all todos ordered by ascending `id`.
 */
export async function listTodos(): Promise<Todo[]> {
  const result = await query(
    'SELECT id, title, done FROM todos ORDER BY id ASC',
  );
  return result.rows as unknown as Todo[];
}

/**
 * Flip the `done` flag on the todo with the given `id`.
 * Returns the updated record, or `null` if no row matched.
 */
export async function toggleTodo(id: number): Promise<Todo | null> {
  const result = await query(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done',
    [id],
  );
  return (result.rows[0] as unknown as Todo | undefined) ?? null;
}
