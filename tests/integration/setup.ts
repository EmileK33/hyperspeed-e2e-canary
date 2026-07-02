/**
 * tests/integration/setup.ts
 *
 * Global setup utilities for the integration suite.
 *
 * This module is *not* a vitest globalSetup file — it exports plain helpers
 * that individual test files can call inside `beforeAll` / `afterAll`. Keeping
 * setup as helpers (rather than a vitest globalSetup hook) avoids the extra
 * worker-boundary plumbing and makes the per-test intent explicit.
 *
 * Phase-safe: every helper no-ops gracefully when Postgres is unavailable so
 * that the suite stays green in phase-0 environments where the schema hasn't
 * been created yet.
 */

import { withDbClient, hasDatabase } from './fixtures.js';

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

/**
 * Idempotently create the application tables needed by the integration suite.
 * Skips silently when DATABASE_URL is absent (Phase 0 / CI environments that
 * haven't wired a Postgres service yet).
 *
 * Each feature session owns its own schema DDL; the harness only needs to
 * ensure the tables exist before the tests that depend on them run.
 */
export async function bootstrapSchema(): Promise<void> {
  if (!hasDatabase()) return;

  await withDbClient(async (client) => {
    // todos table — owned by the store session (Phase 1)
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id        SERIAL PRIMARY KEY,
        list_id   INTEGER,
        title     TEXT    NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // lists table — owned by the lists-routes session (Phase 2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  });
}

/**
 * Truncate all application tables so each test run starts from a clean slate.
 * No-ops when DATABASE_URL is absent.
 */
export async function resetDatabase(): Promise<void> {
  if (!hasDatabase()) return;

  await withDbClient(async (client) => {
    // RESTART IDENTITY resets sequences; CASCADE handles FK references.
    await client.query(`
      TRUNCATE todos, lists RESTART IDENTITY CASCADE
    `).catch(() => {
      // Tables may not exist yet (Phase 0) — swallow the error.
    });
  });
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------
export { hasDatabase, getDatabaseUrl, startTestServer, jsonRequest } from './fixtures.js';
