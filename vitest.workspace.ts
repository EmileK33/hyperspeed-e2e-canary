import { defineWorkspace } from 'vitest/config';

/**
 * Workspace root — globs every *.test.ts under tests/.
 * Auto-discovery: adding a new test file under tests/ picks it up
 * without editing this file. Do NOT narrow this glob.
 */
export default defineWorkspace([
  {
    test: {
      include: ['tests/**/*.test.ts'],
    },
  },
]);
