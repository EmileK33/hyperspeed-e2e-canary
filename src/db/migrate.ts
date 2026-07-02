// src/db/migrate.ts
//
// Idempotent schema migrations.  Called once at server startup (or by the
// integration-test harness before the first suite runs).  Every statement
// uses IF NOT EXISTS so it is safe to run multiple times.

import { getPool } from './pool.js';

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS todos (
    id         SERIAL PRIMARY KEY,
    title      TEXT        NOT NULL,
    done       BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id         SERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

/**
 * Apply all pending migrations in order.
 * Safe to call multiple times (idempotent via IF NOT EXISTS).
 */
export async function migrate(): Promise<void> {
  const pool = await getPool();
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
}
