/**
 * Postgres connection pool.
 *
 * Wraps `pg.Pool` with a typed query helper so route/store files can
 * execute parameterised SQL without importing `pg` directly.
 *
 * `pg` is declared as an optional peer-dependency; when running unit tests
 * without a real Postgres instance the pool is never instantiated.
 */

import { optionalEnv } from '../lib/env.ts';

/** A single row returned by a SQL query (column names → values). */
export type Row = Record<string, unknown>;

/** Minimal typed query result mirroring pg.QueryResult<R>. */
export interface QueryResult<R extends Row = Row> {
  rows: R[];
  rowCount: number | null;
}

/** Interface that matches the subset of `pg.Pool` we use. */
export interface Pool {
  query<R extends Row = Row>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
  end(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Lazy singleton — only created when first referenced from production code.
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;

/**
 * Returns (and lazily creates) the shared Postgres pool.
 * Throws at construction time if `DATABASE_URL` is not set.
 *
 * Import `pg` dynamically so unit tests that never call this function
 * don't fail due to the package being absent.
 */
export async function getPool(): Promise<Pool> {
  if (_pool) return _pool;

  const databaseUrl = optionalEnv('DATABASE_URL', '');
  if (!databaseUrl) {
    throw new Error(
      'Cannot create Postgres pool: DATABASE_URL is not set.',
    );
  }

  // Dynamic import keeps `pg` out of the module graph for test environments.
  // Use a variable specifier so TypeScript skips static module resolution.
  const pgMod = 'pg';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg = await import(/* @vite-ignore */ pgMod) as any;
  const PgPool = pg.Pool ?? pg.default?.Pool;
  _pool = new PgPool({ connectionString: databaseUrl }) as unknown as Pool;
  return _pool;
}

/**
 * Execute a parameterised SQL query using the shared pool.
 * Convenience wrapper so callers don't have to await `getPool()` themselves.
 */
export async function query<R extends Row = Row>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<R>> {
  const pool = await getPool();
  return pool.query<R>(text, values);
}

/**
 * Tear down the pool (used in tests / graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/** Replace the pool singleton — useful for injecting a mock in tests. */
export function _setPool(pool: Pool | null): void {
  _pool = pool;
}
