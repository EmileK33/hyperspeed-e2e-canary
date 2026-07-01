import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config.
 * Per-test schema migrations are handled by `beforeAll` in individual test files
 * (see smoke.test.ts) rather than globalSetup, so the integration suite works
 * even when Postgres is not configured.
 */
export default defineConfig({
  test: {
    environment: 'node',
  },
});
