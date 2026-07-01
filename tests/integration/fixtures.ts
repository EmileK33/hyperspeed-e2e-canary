/**
 * Integration-test fixtures — database helpers.
 *
 * DATABASE_URL is set by CI (native Postgres service) and by local docker-compose
 * (`postgres://todos:todos@localhost:5432/todos`).
 *
 * All DB-dependent helpers and tests gate on `hasDatabase` so the suite remains
 * green in Phase 0 where `pg` may not yet be installed in the workspace.
 */

import { createRequire } from 'node:module';

/** Raw connection string from the environment (empty string when absent). */
export const DB_URL = process.env.DATABASE_URL ?? '';

/** True when a Postgres instance is configured for this run. */
export const hasDatabase = Boolean(DB_URL);

/** Minimal interface for a connected Postgres client (subset of `pg.Client`). */
export interface DbClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

/**
 * Opens a `pg.Client` connected to `DATABASE_URL`.
 *
 * IMPORTANT: the caller is responsible for calling `client.end()` after use
 * (use try/finally).  Only call this inside `it.skipIf(!hasDatabase)` blocks.
 *
 * `pg` is loaded via `createRequire` rather than `import()` so Vite does not
 * attempt to resolve or pre-bundle the module during test file transformation —
 * it is resolved by Node.js at runtime once `npm ci` has installed the dep.
 */
export async function getDbClient(): Promise<DbClient> {
  if (!hasDatabase) {
    throw new Error(
      'DATABASE_URL is not set — wrap the caller with it.skipIf(!hasDatabase)',
    );
  }

  const _require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pg: any;
  try {
    pg = _require('pg');
  } catch {
    throw new Error(
      'pg package not found — run `npm ci` to install runtime dependencies',
    );
  }

  const ClientCtor: new (cfg: { connectionString: string }) => DbClient & {
    connect(): Promise<void>;
  } = pg.default?.Client ?? pg.Client;

  const client = new ClientCtor({ connectionString: DB_URL });
  await client.connect();
  return client;
}
