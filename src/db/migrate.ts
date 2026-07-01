/**
 * Schema migration runner.
 *
 * Executes a built-in ordered list of SQL migrations against the supplied pool.
 * Each migration runs inside its own statement; the _migrations table tracks
 * what has been applied so re-runs are idempotent.
 */

import type { DbPool } from './pool.ts';

export interface MigrationRecord {
  name: string;
  appliedAt: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface Migration {
  name: string;
  sql: string;
}

/** Ordered list of schema migrations. */
const MIGRATIONS: Migration[] = [
  {
    name: '001_create_lists',
    sql: `
      CREATE TABLE IF NOT EXISTS lists (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: '002_create_todos',
    sql: `
      CREATE TABLE IF NOT EXISTS todos (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        title       TEXT        NOT NULL,
        completed   BOOLEAN     NOT NULL DEFAULT FALSE,
        list_id     UUID        REFERENCES lists(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
];

/**
 * Run all pending migrations.
 *
 * @param pool  A DbPool instance connected to the target database.
 * @returns     Names of migrations that were applied or skipped.
 */
export async function runMigrations(pool: DbPool): Promise<MigrationResult> {
  // Ensure the bookkeeping table exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL      PRIMARY KEY,
      name        TEXT        NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    const existing = await pool.query<{ name: string }>(
      'SELECT name FROM _migrations WHERE name = $1',
      [migration.name]
    );

    if (existing.rows.length > 0) {
      skipped.push(migration.name);
      continue;
    }

    await pool.query(migration.sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [
      migration.name,
    ]);
    applied.push(migration.name);
  }

  return { applied, skipped };
}

/**
 * List all migrations that have been applied to this database.
 */
export async function listAppliedMigrations(
  pool: DbPool
): Promise<MigrationRecord[]> {
  const result = await pool.query<{ name: string; applied_at: string }>(
    "SELECT name, applied_at FROM _migrations ORDER BY id"
  );
  return result.rows.map((r) => ({ name: r.name, appliedAt: r.applied_at }));
}
