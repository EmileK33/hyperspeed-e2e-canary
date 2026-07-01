/**
 * Database connection pool.
 *
 * Wraps the `pg` Pool in a lazy singleton so tests that do not need a real
 * Postgres connection can import this module without side-effects until
 * `getPool()` is first called.
 *
 * Other modules should call `getPool()` to obtain the shared pool, and
 * `closePool()` in teardown / graceful-shutdown handlers.
 */

let _pool: unknown | null = null;

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface PoolClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  release(): void;
}

export interface Pool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

/**
 * Returns the singleton pool, creating it on first call.
 * Throws if `DATABASE_URL` is not set in the environment.
 */
export async function getPool(): Promise<Pool> {
  if (_pool) return _pool as Pool;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Dynamic import keeps the compile-time dependency optional.
  const pg = await import('pg');
  const PgPool = pg.default?.Pool ?? (pg as unknown as { Pool: new (opts: Record<string, unknown>) => Pool }).Pool;
  _pool = new PgPool({ connectionString: databaseUrl });
  return _pool as Pool;
}

/** Close the pool and reset the singleton (useful in tests and shutdown). */
export async function closePool(): Promise<void> {
  if (_pool) {
    await (_pool as Pool).end();
    _pool = null;
  }
}

/** Replace the singleton with a test double (for unit tests). */
export function setPool(pool: Pool | null): void {
  _pool = pool;
}
