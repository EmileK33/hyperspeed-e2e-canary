/**
 * Integration-test global setup (Vitest globalSetup module).
 *
 * Exported `setup` / `teardown` are called once by Vitest before / after the
 * entire test run.  When `DATABASE_URL` is absent (Phase 0 without Postgres)
 * the functions return immediately so the suite stays green.
 *
 * The `runMigrations` helper is also exported so individual test files can
 * call it in a `beforeAll` if they need to ensure schema exists.
 */

import { hasDatabase, getDbClient } from './fixtures.ts';

/** Creates all application tables (idempotent — uses CREATE TABLE IF NOT EXISTS). */
export async function runMigrations(): Promise<void> {
  if (!hasDatabase) return;

  const client = await getDbClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id    SERIAL  PRIMARY KEY,
        title TEXT    NOT NULL,
        done  BOOLEAN NOT NULL DEFAULT false
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id   SERIAL PRIMARY KEY,
        name TEXT   NOT NULL
      )
    `);
  } finally {
    await client.end();
  }
}

/** Vitest globalSetup — runs once before any test file. */
export async function setup(): Promise<void> {
  await runMigrations();
}

/**
 * Vitest globalTeardown — runs once after all tests complete.
 * Tables are intentionally left in place so later integration waves
 * can read rows inserted by earlier phases.
 */
export async function teardown(): Promise<void> {
  // intentional no-op
}
