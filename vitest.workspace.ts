import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — single-owner glob registry.
 * Sessions NEVER edit this file; they drop test files into the
 * globs defined here and they are auto-discovered.
 */
export default defineWorkspace([
  {
    test: {
      name: 'integration',
      include: ['tests/**/*.test.ts'],
    },
  },
]);
