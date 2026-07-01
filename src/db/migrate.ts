/**
 * Database migrations.
 *
 * Runs idempotent `CREATE TABLE IF NOT EXISTS` statements so the schema is
 * always up-to-date before the server starts accepting requests.
 */

import { getPool } from './pool.ts';

const SCHEMA_SQL = /* sql */ `
  CREATE TABLE IF NOT EXISTS lists (
    id         SERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS todos (
    id         SERIAL PRIMARY KEY,
    title      TEXT        NOT NULL,
    done       BOOLEAN     NOT NULL DEFAULT FALSE,
    list_id    INTEGER     REFERENCES lists(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/**
 * Apply the canary schema to the connected database.
 * Safe to call multiple times — all statements are idempotent.
 */
export async function migrate(): Promise<void> {
  const pool = await getPool();
  await pool.query(SCHEMA_SQL);
}

/**
 * Drop all canary tables (used in test teardown).
 * Does NOT drop the database itself.
 */
export async function dropSchema(): Promise<void> {
  const pool = await getPool();
  await pool.query(`
    DROP TABLE IF EXISTS todos;
    DROP TABLE IF EXISTS lists;
  `);
}
