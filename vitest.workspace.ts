import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — single-owner glob registry.
 * Sessions add new projects here via their owned globs; they never edit
 * existing entries to avoid merge conflicts.
 */
export default defineWorkspace([
  // Unit / session tests (no Postgres required)
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/integration/**'],
    },
  },
  // Integration tests (requires DATABASE_URL / Postgres fixture)
  {
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
    },
  },
]);
