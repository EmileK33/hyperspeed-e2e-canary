/**
 * Vitest global setup for the integration suite.
 *
 * Exports `setup` and `teardown` hooks that Vitest invokes once (not per-file)
 * when this module is listed under `test.globalSetup` in vitest.config.ts.
 *
 * Phase-0: no external resources to provision; the functions are intentional
 * no-ops that establish the correct lifecycle shape for later waves.
 *
 * Later waves (store / routes) extend this module to:
 *   - apply DB migrations against the fixture Postgres (`DATABASE_URL`)
 *   - seed baseline rows
 *   - tear down / rollback after the suite finishes
 *
 * Keeping the hooks here (rather than in individual test files) ensures the
 * DB is ready before the first parallel worker runs.
 */

/** Called once before any integration test file is imported. */
export async function setup(): Promise<void> {
  // Phase-0 no-op.
  // Example for future waves:
  //   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  //   await pool.query('CREATE TABLE IF NOT EXISTS …');
  //   await pool.end();
}

/** Called once after all integration test files have finished. */
export async function teardown(): Promise<void> {
  // Phase-0 no-op.
}
