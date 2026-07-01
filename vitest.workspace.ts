import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — single-owner glob registry (S0-B).
 * Other sessions MUST NOT edit this file.
 * Adding a new test file under tests/** is auto-discovered via the glob below.
 */
export default defineWorkspace([
  {
    test: {
      name: 'all',
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  },
]);
