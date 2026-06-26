/**
 * Vitest global setup for the integration test suite.
 *
 * - Verifies Node version supports the built-in fetch API (Node ≥ 18).
 * - Re-exported via vitest config's `setupFiles` so every integration spec
 *   gets the same baseline environment.
 */

import { beforeAll } from 'vitest';

beforeAll(() => {
  // Ensure native fetch is available (Node 18+)
  if (typeof globalThis.fetch !== 'function') {
    throw new Error(
      'Global fetch is not available. Run tests with Node 18 or later.',
    );
  }
});
