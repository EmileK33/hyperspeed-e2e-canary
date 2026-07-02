// Database migration runner — shared scaffold, owned by S0-A.
// Applies DDL to the connected Postgres database.  Feature sessions
// call `runMigrations()` (or the harness does) before any DML.

import { getPool } from './pool.js';

/** DDL executed once to bootstrap the schema. */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lists (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id    SERIAL PRIMARY KEY,
  title TEXT    NOT NULL,
  done  BOOLEAN NOT NULL DEFAULT false,
  list_id INTEGER REFERENCES lists(id) ON DELETE SET NULL
);
`.trim();

/**
 * Apply the canonical schema to the database.  Safe to call multiple times
 * (uses CREATE TABLE IF NOT EXISTS).
 */
export async function runMigrations(): Promise<void> {
  const pool = await getPool();
  await pool.query(SCHEMA_SQL);
}

/**
 * Drop all owned tables in reverse dependency order.
 * Intended only for test teardown / CI resets — never call in production.
 */
export async function dropSchema(): Promise<void> {
  const pool = await getPool();
  await pool.query('DROP TABLE IF EXISTS todos; DROP TABLE IF EXISTS lists;');
}
