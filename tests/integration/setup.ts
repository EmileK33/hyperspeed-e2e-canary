/**
 * Vitest global setup for the integration suite.
 *
 * Registered as a setupFile in vitest.config.ts (or via --setup).
 * Ensures the shared Postgres pool is cleaned up after every test file,
 * preventing open handles from blocking process exit.
 */
import { afterAll } from 'vitest';
import { teardown } from './fixtures.js';

afterAll(async () => {
  await teardown().catch(() => {
    // Ignore teardown errors — the pool may never have been opened.
  });
});
