/**
 * Todo store — typed CRUD operations backed by Postgres.
 *
 * All functions obtain the shared pool via `getPool()` so tests can inject
 * a mock pool with `setPool()` from `src/db/pool.ts` without requiring a
 * real database connection.
 */

import { getPool } from '../db/pool.ts';

// ---------------------------------------------------------------------------
// Re-export the canonical Todo type so route handlers import from one place.
// ---------------------------------------------------------------------------

export type { Todo } from '../types/contracts.ts';
import type { Todo } from '../types/contracts.ts';

// ---------------------------------------------------------------------------
// Row shape returned directly from pg queries
// ---------------------------------------------------------------------------

interface TodoRow {
  id: number;
  title: string;
  done: boolean;
  list_id: number | null;
  created_at: string | Date;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    list_id: row.list_id,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Store operations
// ---------------------------------------------------------------------------

/**
 * Insert a new todo row and return the persisted record.
 */
export async function createTodo(
  title: string,
  list_id?: number | null,
): Promise<Todo> {
  const pool = await getPool();
  const result = await pool.query<TodoRow>(
    `INSERT INTO todos (title, list_id)
     VALUES ($1, $2)
     RETURNING id, title, done, list_id, created_at`,
    [title, list_id ?? null],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createTodo: INSERT returned no rows');
  }
  return rowToTodo(row);
}

/**
 * Fetch a single todo by primary key.
 * Returns `null` when no matching row exists.
 */
export async function getTodo(id: number): Promise<Todo | null> {
  const pool = await getPool();
  const result = await pool.query<TodoRow>(
    `SELECT id, title, done, list_id, created_at
     FROM todos
     WHERE id = $1`,
    [id],
  );

  const row = result.rows[0];
  return row ? rowToTodo(row) : null;
}

/**
 * Return every todo row, newest first.
 */
export async function listTodos(): Promise<Todo[]> {
  const pool = await getPool();
  const result = await pool.query<TodoRow>(
    `SELECT id, title, done, list_id, created_at
     FROM todos
     ORDER BY id DESC`,
  );

  return result.rows.map(rowToTodo);
}

/**
 * Flip the `done` flag for the given todo.
 * Returns the updated record, or `null` if no row was found.
 */
export async function toggleTodo(id: number): Promise<Todo | null> {
  const pool = await getPool();
  const result = await pool.query<TodoRow>(
    `UPDATE todos
     SET done = NOT done
     WHERE id = $1
     RETURNING id, title, done, list_id, created_at`,
    [id],
  );

  const row = result.rows[0];
  return row ? rowToTodo(row) : null;
}
