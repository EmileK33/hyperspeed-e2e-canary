/**
 * Vitest globalSetup — runs once before any test file in the integration suite.
 *
 * Responsibility: provision the shared fixture Postgres schema so all feature
 * sessions can read/write rows against stable tables without re-creating them.
 *
 * When DATABASE_URL is not present (local run without Docker, unit-only CI)
 * the setup is a no-op and tests that need a live DB skip themselves via
 * `it.skipIf(!process.env.DATABASE_URL)`.
 */
export async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const { applySchema } = await import('./fixtures.ts');
  await applySchema();
}

export async function teardown(): Promise<void> {
  // Schema is intentionally preserved across integration waves so that later
  // feature sessions (store, routes) find the tables they expect.
}
