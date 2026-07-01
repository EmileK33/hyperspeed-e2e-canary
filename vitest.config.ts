import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Global setup/teardown for the full integration suite.
     * Phase-safe: setup.ts no-ops gracefully when DATABASE_URL is absent.
     */
    globalSetup: ['tests/integration/setup.ts'],
    /**
     * Default include — picked up by `vitest run` (no args) and by the
     * workspace.  The `test:integration` script narrows this to
     * tests/integration via the CLI path argument.
     */
    include: ['tests/**/*.test.ts'],
    /**
     * Use Node environment so Node built-ins (http, net, …) resolve
     * correctly for server-boot tests in later phases.
     */
    environment: 'node',
  },
});
