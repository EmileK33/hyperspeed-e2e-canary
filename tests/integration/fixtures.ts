/**
 * Integration test fixtures — Postgres connection helpers.
 *
 * Usage:
 *   import { getDb, teardown } from './fixtures.js';
 *
 *   const db = getDb();               // returns the shared Pool
 *   await db.query('SELECT 1');
 *   await teardown();                 // closes pool; idempotent
 *
 * When DATABASE_URL is absent (e.g., unit-only CI), getDb() throws and
 * callers are expected to guard with process.env.DATABASE_URL checks.
 */

import type { Pool as PoolType } from 'pg';

let pool: PoolType | undefined;

/**
 * Returns the shared Postgres connection pool, lazily creating it on first
 * call.  Throws if DATABASE_URL is not set.
 */
export async function getDb(): Promise<PoolType> {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set — cannot connect to the fixture database.',
    );
  }

  // Dynamic import so that environments without `pg` installed (rare) still
  // allow the fixtures module to be imported without a hard crash at parse time.
  const { default: PgPool } = await import('pg').then((m) => ({
    default: m.default?.Pool ?? m.Pool,
  }));

  pool = new PgPool({ connectionString: url }) as PoolType;
  return pool;
}

/**
 * Gracefully closes the shared pool.  Safe to call multiple times.
 */
export async function teardown(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } finally {
      pool = undefined;
    }
  }
}
