import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * globalSetup runs once per vitest process, before any test files load.
     * The integration setup provisions the shared fixture Postgres schema.
     * It is a no-op when DATABASE_URL is absent.
     */
    globalSetup: ['tests/integration/setup.ts'],
  },
});
