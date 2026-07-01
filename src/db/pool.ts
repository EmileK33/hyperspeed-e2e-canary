/**
 * Database connection pool.
 * Exports a settable DbClient so tests can inject a mock
 * and production code can swap in the real `pg` pool.
 * S0-A: Shared scaffold / infrastructure
 */

import type { DbClient } from '../types/contracts.ts';

/** Stub client used when no real pool has been configured. */
function createStubClient(): DbClient {
  return {
    async query<T = unknown>(
      _sql: string,
      _params?: unknown[]
    ): Promise<{ rows: T[] }> {
      throw new Error(
        'Database not configured. Call setPool() with a real DbClient or set DATABASE_URL.'
      );
    },
  };
}

let _pool: DbClient = createStubClient();

/** Return the active database client. */
export function getPool(): DbClient {
  return _pool;
}

/**
 * Replace the active database client.
 * Call this during application bootstrap or in tests to inject a mock.
 */
export function setPool(client: DbClient): void {
  _pool = client;
}

/**
 * Reset the pool to the stub (useful between tests).
 */
export function resetPool(): void {
  _pool = createStubClient();
}
