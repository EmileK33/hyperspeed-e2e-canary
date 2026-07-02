// Postgres connection pool — shared scaffold, owned by S0-A.
// Wraps the `pg` package behind a thin interface so every feature module
// imports from here rather than coupling directly to `pg`.

/** Minimal query-result shape used across the codebase. */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

/** Subset of the `pg.Pool` API we actually use. */
export interface DbPool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

let _pool: DbPool | undefined;

/**
 * Return (and lazily create) the shared Postgres pool.
 * Requires DATABASE_URL to be set in the environment.
 *
 * The function dynamically imports `pg` so that modules that import
 * this file can still be tested without `pg` installed — as long as
 * `getPool()` is never actually called in those tests.
 */
export async function getPool(): Promise<DbPool> {
  if (_pool) return _pool;
  // Dynamic import keeps this module loadable even when pg is absent.
  const { default: pg } = (await import('pg')) as { default: typeof import('pg') };
  const { Pool } = pg;
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');
  _pool = new Pool({ connectionString: url }) as unknown as DbPool;
  return _pool;
}

/**
 * Close the pool (call in test teardown or graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
  }
}

/** Inject a pool instance (useful in tests). */
export function setPool(pool: DbPool): void {
  _pool = pool;
}
