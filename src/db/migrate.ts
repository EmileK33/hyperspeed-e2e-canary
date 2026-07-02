// Schema-migration runner — owned by S0-A (Phase 0).
// Applies CREATE TABLE IF NOT EXISTS statements so the schema is always
// present before the first route handler tries to query it. Idempotent:
// safe to call on every server start.

import type { Pool } from './pool.js';

// ---------------------------------------------------------------------------
// DDL statements
// ---------------------------------------------------------------------------

/** Lists table must be created before todos (FK dependency). */
const CREATE_LISTS = `
  CREATE TABLE IF NOT EXISTS lists (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CREATE_TODOS = `
  CREATE TABLE IF NOT EXISTS todos (
    id         SERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    done       BOOLEAN NOT NULL DEFAULT FALSE,
    list_id    INTEGER REFERENCES lists(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations against the given pool.
 * Statements are applied in dependency order and are idempotent.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(CREATE_LISTS);
  await pool.query(CREATE_TODOS);
}
