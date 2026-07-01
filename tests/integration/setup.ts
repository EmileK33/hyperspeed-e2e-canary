/**
 * Vitest global setup for the integration suite.
 *
 * Runs ONCE before any test file executes (in the main Vitest process,
 * not inside worker threads). Exported functions follow the Vitest
 * globalSetup contract: `setup()` / `teardown()`.
 *
 * Phase-safe: at Phase 0 no application code exists yet, so setup is
 * intentionally lightweight — it validates environment and emits a
 * diagnostic if DATABASE_URL is absent (skips DB work rather than
 * failing, so the integration gate passes at every wave).
 */

import { hasDatabaseUrl, TEST_DATABASE_URL } from './fixtures.ts';

export async function setup(): Promise<void> {
  console.log('[integration/setup] Starting integration harness setup…');

  if (!hasDatabaseUrl()) {
    console.warn(
      '[integration/setup] DATABASE_URL is not set — DB-dependent tests will be skipped.',
    );
    return;
  }

  console.log(
    `[integration/setup] DATABASE_URL detected (${redactUrl(TEST_DATABASE_URL)}).`,
  );

  // Phase 1+ will add schema migration logic here via src/store/todos.ts.
  // For now we just verify the URL is parseable.
  try {
    new URL(TEST_DATABASE_URL);
    console.log('[integration/setup] DATABASE_URL is a valid URL — ready.');
  } catch {
    throw new Error(
      `[integration/setup] DATABASE_URL is set but not a valid URL: ${TEST_DATABASE_URL}`,
    );
  }
}

export async function teardown(): Promise<void> {
  console.log('[integration/setup] Teardown complete.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Redact password from a Postgres URL for safe logging. */
function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<invalid-url>';
  }
}
