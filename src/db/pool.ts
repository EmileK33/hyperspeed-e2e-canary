/**
 * Database connection pool abstraction.
 *
 * We define our own `Pool` interface so the rest of the codebase stays
 * decoupled from the `pg` package.  The real pg.Pool is injected at
 * server startup via `configurePool()`; tests inject a stub.
 */

// ── Pool interface ───────────────────────────────────────────────

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface Pool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

// ── Singleton factory ────────────────────────────────────────────

type PoolFactory = () => Pool;

let _factory: PoolFactory | null = null;
let _instance: Pool | null = null;

/**
 * Register the factory that creates the real pg.Pool.
 * Must be called once at application startup before any DB access.
 */
export function configurePool(factory: PoolFactory): void {
  _factory = factory;
  _instance = null; // reset so next getPool() creates a fresh instance
}

/**
 * Return the singleton pool, creating it on first access.
 * Throws if `configurePool()` has not been called.
 */
export function getPool(): Pool {
  if (!_instance) {
    if (!_factory) {
      throw new Error(
        'Database pool is not configured. Call configurePool() before accessing the pool.',
      );
    }
    _instance = _factory();
  }
  return _instance;
}

/**
 * Tear down the pool and clear the singleton.
 * Useful for graceful shutdown and test teardown.
 */
export async function closePool(): Promise<void> {
  if (_instance) {
    await _instance.end();
    _instance = null;
  }
}

/** Reset internal state — for testing only. */
export function _resetPool(): void {
  _factory = null;
  _instance = null;
}
