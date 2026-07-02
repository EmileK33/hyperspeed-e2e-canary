import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use node environment for all tests (backend API project)
    environment: 'node',
    // Allow importing .ts extensions directly (no build step)
    globals: false,
    // Timeout for individual tests (ms)
    testTimeout: 10_000,
    // Hook timeout (ms) — covers server start/stop in setup
    hookTimeout: 15_000,
  },
});
