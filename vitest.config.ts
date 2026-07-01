import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the integration test suite.
 * `npm run test:integration` → `vitest run tests/integration`
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
