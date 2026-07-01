/**
 * Global setup / teardown for the integration test suite.
 *
 * Vitest picks this up via `vitest.config.ts` → `test.globalSetup`.
 * Phase-safe: gracefully no-ops when DATABASE_URL is absent.
 */
import { hasDatabase } from './fixtures.js';

export async function setup(): Promise<void> {
  if (!hasDatabase()) {
    console.log(
      '[integration:setup] DATABASE_URL not set — skipping DB provisioning.',
    );
    return;
  }

  // Phase 1+ sessions extend this once src/store/todos.ts exists and
  // the schema migration helper is available.
  console.log('[integration:setup] DATABASE_URL detected; DB ready.');
}

export async function teardown(): Promise<void> {
  // Per-test cleanup is handled inside each feature-session test file.
  // Nothing to do here at Phase 0.
}
