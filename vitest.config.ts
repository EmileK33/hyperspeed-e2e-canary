import { defineConfig } from 'vitest/config';

/**
 * Root vitest config.
 *
 * The `test:integration` script passes `tests/integration` as the include
 * glob directly on the CLI, so this config primarily sets sensible defaults
 * (timeout, env) shared across all test projects.
 */
export default defineConfig({
  test: {
    // Allow individual tests to override via the third argument to it().
    testTimeout: 15_000,
    // Keep the environment explicit so there is no ambiguity across phases.
    environment: 'node',
  },
});
