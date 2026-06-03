import pg from 'pg';
import type { Todo } from '../types.js';

export type { Todo };

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function createTodo(title: string): Promise<Todo> {
  const result = await pool.query<Todo>(
    'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, done',
    [title],
  );
  return result.rows[0];
}

export async function getTodo(id: number | string): Promise<Todo | null> {
  const result = await pool.query<Todo>(
    'SELECT id, title, done FROM todos WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listTodos(): Promise<Todo[]> {
  const result = await pool.query<Todo>('SELECT id, title, done FROM todos');
  return result.rows;
}

export async function toggleTodo(id: number | string): Promise<Todo> {
  const result = await pool.query<Todo>(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done',
    [id],
  );
  return result.rows[0];
}
