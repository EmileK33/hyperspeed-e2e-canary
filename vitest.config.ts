import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Global setup runs once before the entire suite.
    globalSetup: ['tests/integration/setup.ts'],
  },
});
