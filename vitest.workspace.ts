import { defineWorkspace } from 'vitest/config';

/**
 * Single-owner glob registry — sessions NEVER edit this file.
 * Vitest discovers every *.test.ts under tests/ automatically.
 */
export default defineWorkspace([
  {
    test: {
      name: 'integration',
      include: ['tests/**/*.test.ts'],
      testTimeout: 15_000,
    },
  },
]);
