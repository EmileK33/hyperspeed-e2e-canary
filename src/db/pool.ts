// src/db/pool.ts
//
// Lazy singleton Postgres connection pool.  Uses a dynamic import so that
// this module can be imported in unit tests without the `pg` package being
// present.  The pool is only materialised when getPool() is called for the
// first time, which integration tests do after DATABASE_URL is available.

import type { Pool as PgPool } from 'pg';
import { requireEnv } from '../lib/env.js';

let _pool: PgPool | null = null;

/**
 * Return the singleton Postgres pool, creating it on first call.
 * Reads DATABASE_URL from the environment.
 */
export async function getPool(): Promise<PgPool> {
  if (_pool) return _pool;
  const connectionString = requireEnv('DATABASE_URL');
  // Dynamic import keeps `pg` out of the static dependency graph so that
  // unit tests can import this module without pg installed.
  const pg = await import(/* @vite-ignore */ 'pg');
  const PoolCtor = (pg.Pool ?? pg.default?.Pool) as typeof PgPool;
  _pool = new PoolCtor({ connectionString });
  return _pool;
}

/**
 * Drain and close the pool.  Call during test teardown or graceful shutdown.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Inject a pool instance (useful in tests to avoid a real Postgres connection).
 * Pass `null` to reset the singleton.
 */
export function setPool(pool: PgPool | null): void {
  _pool = pool;
}
