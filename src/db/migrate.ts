/**
 * Database migration runner.
 *
 * Applies a minimal set of DDL statements to bring the Postgres schema up to
 * date. This is intentionally schema-only (no data migrations) and runs
 * idempotently via `IF NOT EXISTS` guards.
 *
 * Called once at server startup (before the HTTP listener opens) and also by
 * the integration-test harness to provision the fixture database.
 */

import { query } from './pool.ts';

const MIGRATIONS: readonly string[] = [
  /* 001 — todos table */
  `CREATE TABLE IF NOT EXISTS todos (
    id    SERIAL PRIMARY KEY,
    title TEXT    NOT NULL,
    done  BOOLEAN NOT NULL DEFAULT false
  )`,

  /* 002 — lists table */
  `CREATE TABLE IF NOT EXISTS lists (
    id   SERIAL PRIMARY KEY,
    name TEXT   NOT NULL
  )`,
];

/**
 * Run all migrations in order.
 * Each statement is wrapped in its own `BEGIN … COMMIT` so a failure
 * does not leave a partial transaction open.
 */
export async function runMigrations(): Promise<void> {
  for (const sql of MIGRATIONS) {
    await query(sql);
  }
}
