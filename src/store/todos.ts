// src/store/todos.ts
//
// Data-access layer for the todos table.  All SQL lives here; routes import
// these typed helpers and never write raw queries.

import { getPool } from '../db/pool.js';

/** A single todo item. */
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
  const pool = await getPool();
  const result = await pool.query<Todo>(
    'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, done, created_at',
    [title],
  );
  return result.rows[0];
}

/**
 * Fetch a single todo by primary key.
 * Returns `null` when no row with the given id exists.
 */
export async function getTodo(id: number): Promise<Todo | null> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    'SELECT id, title, done, created_at FROM todos WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

/**
 * Return every todo row ordered by creation time (oldest first).
 */
export async function listTodos(): Promise<Todo[]> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    'SELECT id, title, done, created_at FROM todos ORDER BY created_at ASC',
  );
  return result.rows;
}

/**
 * Flip the `done` flag on a todo and return the updated record.
 * Returns `null` when no row with the given id exists.
 */
export async function toggleTodo(id: number): Promise<Todo | null> {
  const pool = await getPool();
  const result = await pool.query<Todo>(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done, created_at',
    [id],
  );
  return result.rows[0] ?? null;
}
