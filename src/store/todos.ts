// Store module for todo items — owned by S1-B (Phase 1).
// Provides typed CRUD helpers that route handlers call without embedding SQL.
// Connects to Postgres via the shared pool from src/db/pool.ts; tests inject
// a stub pool via setPool() from that same module.

import { getPool } from '../db/pool.js';

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

/** A single todo item. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
  list_id?: number | null;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Store functions
// ---------------------------------------------------------------------------

/**
 * Insert a new todo row and return the created record.
 */
export async function createTodo(
  title: string,
  list_id?: number | null,
): Promise<Todo> {
  const pool = getPool();
  const result = await pool.query<Todo>(
    `INSERT INTO todos (title, done, list_id)
     VALUES ($1, false, $2)
     RETURNING id, title, done, list_id, created_at`,
    [title, list_id ?? null],
  );
  return result.rows[0];
}

/**
 * Fetch a single todo by id. Returns undefined when not found.
 */
export async function getTodo(id: number): Promise<Todo | undefined> {
  const pool = getPool();
  const result = await pool.query<Todo>(
    'SELECT id, title, done, list_id, created_at FROM todos WHERE id = $1',
    [id],
  );
  return result.rows[0];
}

/**
 * Return all todos ordered by creation time (oldest first).
 */
export async function listTodos(): Promise<Todo[]> {
  const pool = getPool();
  const result = await pool.query<Todo>(
    'SELECT id, title, done, list_id, created_at FROM todos ORDER BY id ASC',
  );
  return result.rows;
}

/**
 * Flip the `done` flag on a todo and return the updated record.
 * Returns undefined when no row with that id exists.
 */
export async function toggleTodo(id: number): Promise<Todo | undefined> {
  const pool = getPool();
  const result = await pool.query<Todo>(
    `UPDATE todos
     SET done = NOT done
     WHERE id = $1
     RETURNING id, title, done, list_id, created_at`,
    [id],
  );
  return result.rows[0];
}
