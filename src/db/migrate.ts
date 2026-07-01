/**
 * Database migration runner.
 * Applies SQL migrations in order, tracking applied migrations in a
 * `_migrations` table so each migration runs exactly once.
 */

import type { Pool } from './pool.ts';

export interface Migration {
  name: string;
  sql: string;
}

/** Built-in migrations that establish the base schema. */
export const BASE_MIGRATIONS: Migration[] = [
  {
    name: '001_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '002_create_todos',
    sql: `
      CREATE TABLE IF NOT EXISTS todos (
        id   SERIAL PRIMARY KEY,
        title TEXT    NOT NULL,
        done  BOOLEAN NOT NULL DEFAULT FALSE
      );
    `,
  },
  {
    name: '003_create_lists',
    sql: `
      CREATE TABLE IF NOT EXISTS lists (
        id   SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `,
  },
];

/**
 * Run all pending migrations against the given pool.
 * Safe to call multiple times — already-applied migrations are skipped.
 */
export async function migrate(pool: Pool, migrations: Migration[] = BASE_MIGRATIONS): Promise<void> {
  // Ensure the tracking table exists first (idempotent DDL)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    await pool.query(migration.sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
  }
}
