/**
 * Database schema migrations.
 * Runs idempotent CREATE TABLE IF NOT EXISTS statements.
 * S0-A: Shared scaffold / infrastructure
 */

import type { DbClient } from '../types/contracts.ts';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS todos (
    id        SERIAL PRIMARY KEY,
    title     TEXT        NOT NULL,
    done      BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS lists (
    id        SERIAL PRIMARY KEY,
    name      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/**
 * Apply the canonical schema to the given database client.
 * Safe to call multiple times (idempotent).
 */
export async function runMigrations(db: DbClient): Promise<void> {
  await db.query(SCHEMA_SQL);
}
