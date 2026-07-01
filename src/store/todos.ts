/**
 * Todo store — thin Postgres-backed CRUD layer.
 * US-001: In-memory + Postgres todo store.
 */

import { getPool } from '../db/pool.ts';

/** Core todo entity. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
  created_at?: string;
}

/**
 * Insert a new todo row and return the created record.
 */
export async function createTodo(title: string): Promise<Todo> {
  const pool = getPool();
  const { rows } = await pool.query<Todo>(
    'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, done, created_at',
    [title]
  );
  return rows[0];
}

/**
 * Fetch a single todo by id. Returns undefined when not found.
 */
export async function getTodo(id: number): Promise<Todo | undefined> {
  const pool = getPool();
  const { rows } = await pool.query<Todo>(
    'SELECT id, title, done, created_at FROM todos WHERE id = $1',
    [id]
  );
  return rows[0];
}

/**
 * Return all todos ordered by id ascending.
 */
export async function listTodos(): Promise<Todo[]> {
  const pool = getPool();
  const { rows } = await pool.query<Todo>(
    'SELECT id, title, done, created_at FROM todos ORDER BY id ASC'
  );
  return rows;
}

/**
 * Flip the `done` flag on a todo and return the updated record.
 * Returns undefined when the row does not exist.
 */
export async function toggleTodo(id: number): Promise<Todo | undefined> {
  const pool = getPool();
  const { rows } = await pool.query<Todo>(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done, created_at',
    [id]
  );
  return rows[0];
}
