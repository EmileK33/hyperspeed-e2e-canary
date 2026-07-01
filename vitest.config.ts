import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Reporters: default (verbose in CI via VITEST_REPORTER env)
    reporters: process.env.CI ? ['verbose'] : ['default'],
  },
});
