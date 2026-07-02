/**
 * Todo store — US-001
 *
 * Thin data-access layer for todo items. Every function gets the shared
 * Postgres pool via getPool() so callers never touch SQL directly.
 *
 * Owned by S1-B. Exports are consumed by route handlers in later sessions.
 */

import { getPool } from '../db/pool.js';

// ── Domain type ───────────────────────────────────────────────────────────────

/** A single todo item persisted in the database. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

// ── Store functions ───────────────────────────────────────────────────────────

/**
 * Insert a new todo row and return the created record.
 *
 * @param title  Non-empty text for the todo item.
 */
export async function createTodo(title: string): Promise<Todo> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    `INSERT INTO todos (title, done) VALUES ($1, false) RETURNING id, title, done`,
    [title],
  );
  const row = result.rows[0];
  if (!row) throw new Error('INSERT did not return a row');
  return row;
}

/**
 * Fetch a single todo by its primary key.
 * Returns `undefined` when the row does not exist.
 *
 * @param id  Primary key of the todo.
 */
export async function getTodo(id: number): Promise<Todo | undefined> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    `SELECT id, title, done FROM todos WHERE id = $1`,
    [id],
  );
  return result.rows[0];
}

/**
 * Return all todo rows ordered by insertion time (ascending id).
 */
export async function listTodos(): Promise<Todo[]> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    `SELECT id, title, done FROM todos ORDER BY id ASC`,
  );
  return result.rows;
}

/**
 * Flip the `done` flag of the specified todo and return the updated row.
 * Throws when the row does not exist.
 *
 * @param id  Primary key of the todo to toggle.
 */
export async function toggleTodo(id: number): Promise<Todo> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    `UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Todo with id ${id} not found`);
  return row;
}
