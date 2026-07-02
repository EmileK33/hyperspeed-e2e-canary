/**
 * Global integration-test setup.
 *
 * Imported by vitest via `globalSetup` (see vitest.config.ts).
 * Runs once for the entire integration suite — useful for slow resources
 * (e.g., waiting for a DB, running migrations).
 *
 * For this phase-0 harness the setup is intentionally minimal: just verify
 * the Node.js environment is sane before any test suites execute.
 */

export async function setup(): Promise<void> {
  // Sanity-check: node:http must be importable (catches broken environments).
  const { createServer } = await import('node:http');
  if (typeof createServer !== 'function') {
    throw new Error('[integration setup] node:http.createServer is not available');
  }
}

export async function teardown(): Promise<void> {
  // Nothing to tear down in phase 0.
}
