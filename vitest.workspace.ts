import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — single-owner glob registry (owned by S0-B).
 *
 * Defines one project that globs every *.test.ts under tests/.
 * Sessions never edit this file; they simply drop new test files and
 * the glob auto-discovers them.
 */
export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['tests/**/*.test.ts'],
    },
  },
]);
