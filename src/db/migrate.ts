/**
 * Database migration runner.
 * Applies SQL DDL statements in order against the active pool.
 */

import { getPool } from './pool.ts';

/** A single migration step. */
export interface Migration {
  name: string;
  up: string;
}

/** Built-in schema migrations applied at startup. */
export const MIGRATIONS: Migration[] = [
  {
    name: '001_create_todos',
    up: `
      CREATE TABLE IF NOT EXISTS todos (
        id         SERIAL PRIMARY KEY,
        title      TEXT        NOT NULL,
        done       BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '002_create_lists',
    up: `
      CREATE TABLE IF NOT EXISTS lists (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '003_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
];

/**
 * Run all pending migrations against the active pool.
 * Safe to call multiple times (idempotent via IF NOT EXISTS / tracking table).
 */
export async function runMigrations(
  migrations: Migration[] = MIGRATIONS
): Promise<void> {
  const pool = getPool();

  // Ensure the tracking table exists first.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of migrations) {
    const { rows } = await pool.query<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [migration.name]
    );

    if (rows.length === 0) {
      await pool.query(migration.up);
      await pool.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [migration.name]
      );
    }
  }
}
