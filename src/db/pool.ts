// Postgres connection-pool abstraction — owned by S0-A (Phase 0).
// Wraps the `pg` Pool behind a thin interface so:
//   (a) every consumer imports from this single module (no raw `new Pool()`),
//   (b) tests can inject a stub pool via setPool() without a real Postgres,
//   (c) the module loads cleanly even when `pg` is absent (e.g. unit tests
//       that never call initPool()).

import { getEnvOptional } from '../lib/env.js';

// ---------------------------------------------------------------------------
// Minimal interface — mirrors the subset of pg.Pool / pg.PoolClient that
// the app actually uses, letting tests supply a simple stub.
// ---------------------------------------------------------------------------

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface PoolClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}

export interface Pool {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;

/**
 * Return the live pool.
 * Throws if initPool() has not been called yet (or DATABASE_URL was absent).
 */
export function getPool(): Pool {
  if (!_pool) {
    throw new Error(
      'Database pool not initialised — call initPool() before getPool(), ' +
      'or ensure DATABASE_URL is set.',
    );
  }
  return _pool;
}

/**
 * Inject a pool directly — intended for tests that supply a stub/mock pool
 * without needing a real Postgres connection.
 */
export function setPool(pool: Pool): void {
  _pool = pool;
}

/**
 * Initialise the real pg Pool from DATABASE_URL.
 * Safe to call at startup: if DATABASE_URL is absent (unit-test environment)
 * it is a no-op. If `pg` fails to import the error propagates so the
 * operator knows the dep is missing.
 */
export async function initPool(): Promise<void> {
  const databaseUrl = getEnvOptional('DATABASE_URL');
  if (!databaseUrl) {
    // No DATABASE_URL configured — pool stays null.
    // Callers that need a real DB will get a clear error from getPool().
    return;
  }
  // Dynamic import keeps the module loadable even when pg is absent.
  const pg = await import('pg');
  const PgPool = (pg as unknown as { default: { Pool: new (cfg: { connectionString: string }) => Pool } }).default?.Pool
    ?? (pg as unknown as { Pool: new (cfg: { connectionString: string }) => Pool }).Pool;
  _pool = new PgPool({ connectionString: databaseUrl });
}

/** Tear down the pool (used in graceful-shutdown / test teardown). */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
