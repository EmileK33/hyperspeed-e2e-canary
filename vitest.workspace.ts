import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — auto-discovers every *.test.ts under tests/.
 *
 * Pre-seeded: do NOT narrow this glob; doing so breaks auto-discovery
 * for feature sessions that add tests in their own sub-directories.
 */
export default defineWorkspace([
  {
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      globalSetup: ['tests/integration/setup.ts'],
    },
  },
]);
