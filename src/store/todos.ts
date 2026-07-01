/**
 * Todo store — CRUD operations backed by Postgres.
 * Delegates DB access to the shared pool from src/db/pool.ts.
 * S1-C: store
 */

import { getPool } from '../db/pool.ts';
import type { Todo as ContractTodo } from '../types/contracts.ts';

// Re-export the canonical Todo type as required by the session contract.
export type { Todo } from '../types/contracts.ts';

// Internal alias for use within this file.
type Todo = ContractTodo;

/**
 * Insert a new todo row.
 * @param title  The todo title text.
 * @returns      The newly created Todo row.
 */
export async function createTodo(title: string): Promise<Todo> {
  const db = getPool();
  const result = await db.query<Todo>(
    'INSERT INTO todos (title, done) VALUES ($1, false) RETURNING id, title, done, created_at::text AS created_at',
    [title],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('createTodo: INSERT returned no row');
  }
  return row;
}

/**
 * Fetch a single todo by id.
 * @param id  The todo's primary key.
 * @returns   The Todo row, or undefined if not found.
 */
export async function getTodo(id: number): Promise<Todo | undefined> {
  const db = getPool();
  const result = await db.query<Todo>(
    'SELECT id, title, done, created_at::text AS created_at FROM todos WHERE id = $1',
    [id],
  );
  return result.rows[0];
}

/**
 * Return all todos ordered by creation time ascending.
 */
export async function listTodos(): Promise<Todo[]> {
  const db = getPool();
  const result = await db.query<Todo>(
    'SELECT id, title, done, created_at::text AS created_at FROM todos ORDER BY id ASC',
  );
  return result.rows;
}

/**
 * Flip the `done` flag of a todo.
 * @param id  The todo's primary key.
 * @returns   The updated Todo row, or undefined if not found.
 */
export async function toggleTodo(id: number): Promise<Todo | undefined> {
  const db = getPool();
  const result = await db.query<Todo>(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done, created_at::text AS created_at',
    [id],
  );
  return result.rows[0];
}
