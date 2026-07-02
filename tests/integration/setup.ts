/**
 * Integration test setup / teardown helpers.
 *
 * Phase-safe: all DB operations are guarded by `hasDatabase()` so the
 * suite stays green in Phase 0 before the store session ships or a
 * Postgres fixture is available.
 *
 * Usage in a test file:
 *
 *   import { withTestServer, setupDb, teardownDb } from './setup.js';
 *
 *   beforeAll(setupDb);
 *   afterAll(teardownDb);
 */

import { hasDatabase, getDbUrl } from './fixtures.js';

// ---------------------------------------------------------------------------
// DB lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Run the integration schema bootstrap (DDL migrations).
 * No-ops gracefully when DATABASE_URL is absent.
 */
export async function setupDb(): Promise<void> {
  if (!hasDatabase()) {
    // Phase 0 — no DB available yet; skip silently.
    return;
  }

  // Dynamically import `pg` so the module remains importable in Phase 0
  // even before `npm install` pulls in the pg package.
  let Client: new (config: { connectionString: string }) => {
    connect(): Promise<void>;
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  };

  try {
    // @ts-ignore — pg may not be installed yet in early phases
    const pg = await import('pg');
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    console.warn('[integration/setup] pg not available — skipping DB setup.');
    return;
  }

  const client = new Client({ connectionString: getDbUrl() });
  await client.connect();
  try {
    // Bootstrap schema for all feature sessions.
    // Feature sessions (store, routes) extend this via their own migrations;
    // we only ensure the baseline tables exist here.
    await client.query(`
      CREATE TABLE IF NOT EXISTS todo_lists (
        id    SERIAL PRIMARY KEY,
        name  TEXT NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id      SERIAL PRIMARY KEY,
        title   TEXT    NOT NULL,
        done    BOOLEAN NOT NULL DEFAULT FALSE,
        list_id INTEGER REFERENCES todo_lists(id)
      );
    `);
  } finally {
    await client.end();
  }
}

/**
 * Tear down transient test data.
 * No-ops when DATABASE_URL is absent.
 */
export async function teardownDb(): Promise<void> {
  if (!hasDatabase()) return;

  let Client: new (config: { connectionString: string }) => {
    connect(): Promise<void>;
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  };

  try {
    // @ts-ignore — pg may not be installed yet
    const pg = await import('pg');
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    return;
  }

  const client = new Client({ connectionString: getDbUrl() });
  await client.connect();
  try {
    await client.query('DELETE FROM todos;');
    await client.query('DELETE FROM todo_lists;');
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Ephemeral HTTP server helper
// ---------------------------------------------------------------------------

/**
 * Starts an HTTP server on an OS-assigned ephemeral port (port 0) and
 * returns its base URL plus a `close()` function.
 *
 * Use this instead of a hardcoded port so parallel integration runs never
 * collide with a stale server.
 *
 * Example:
 *
 *   const { baseUrl, close } = await withTestServer(createApp());
 *   const res = await fetch(`${baseUrl}/health`);
 *   await close();
 */
export async function withTestServer(
  // Accept any object that has a `listen` method (node:http.Server shape)
  // without importing node types at the top level.
  server: {
    listen(port: number, cb: () => void): unknown;
    close(cb?: (err?: Error) => void): unknown;
    address(): { port: number } | string | null;
  },
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = (): Promise<void> =>
    new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );

  return { baseUrl, close };
}
