/**
 * Integration test fixtures — database schema helpers.
 *
 * These helpers are used by the global setup (setup.ts) and by individual
 * test suites to provision / inspect the shared fixture Postgres database.
 * All functions guard against a missing DATABASE_URL so the module is safe
 * to import even when no database is reachable.
 */

export const SQL_CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS todos (
    id   TEXT    PRIMARY KEY,
    title TEXT   NOT NULL,
    done  BOOLEAN NOT NULL DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS lists (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
`;

export const SQL_DROP_SCHEMA = `
  DROP TABLE IF EXISTS lists;
  DROP TABLE IF EXISTS todos;
`;

/**
 * Create a pg Pool connected to DATABASE_URL.
 * Throws if DATABASE_URL is not set.
 */
export async function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot create pool');
  }
  // Dynamic import keeps this module loadable even when `pg` is absent.
  const pg = await import('pg');
  const Pool = pg.default?.Pool ?? (pg as any).Pool;
  return new Pool({ connectionString: url }) as import('pg').Pool;
}

/** Apply the fixture schema (idempotent via IF NOT EXISTS). */
export async function applySchema(): Promise<void> {
  const pool = await createPool();
  try {
    await pool.query(SQL_CREATE_SCHEMA);
  } finally {
    await pool.end();
  }
}

/** Drop the fixture schema tables. */
export async function dropSchema(): Promise<void> {
  const pool = await createPool();
  try {
    await pool.query(SQL_DROP_SCHEMA);
  } finally {
    await pool.end();
  }
}
