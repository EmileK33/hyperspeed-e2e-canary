/**
 * Database connection pool abstraction.
 * Uses a lazy singleton so the pool is only created on first use,
 * making it safe to import in test environments without a live DB.
 */

/** Minimal interface for a database query result. */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

/** Minimal interface for a database pool / client. */
export interface DbPool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

let pool: DbPool | null = null;

/**
 * Return the active pool. Throws if not yet initialised.
 * Call `setPool()` (or `createPool()`) before first use.
 */
export function getPool(): DbPool {
  if (!pool) {
    throw new Error(
      'Database pool not initialised. Call createPool() before using getPool().'
    );
  }
  return pool;
}

/**
 * Inject an already-constructed pool (e.g. from pg or a test double).
 */
export function setPool(p: DbPool): void {
  pool = p;
}

/**
 * Reset the pool singleton (useful in tests).
 */
export function resetPool(): void {
  pool = null;
}

/**
 * Lazily create a `pg` Pool and register it as the singleton.
 * Only call this in application code (not tests).
 */
export async function createPool(connectionString: string): Promise<DbPool> {
  const { Pool } = (await import('pg')) as typeof import('pg');
  const p = new Pool({ connectionString }) as unknown as DbPool;
  setPool(p);
  return p;
}
