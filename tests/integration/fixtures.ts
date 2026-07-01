/**
 * Integration test fixtures and HTTP helpers.
 *
 * DB operations are no-ops when DATABASE_URL is not set, making this
 * module safe at every integration wave — including wave 1 (Phase 0),
 * before any feature routes or stores exist.
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const TEST_DATABASE_URL = process.env.DATABASE_URL ?? '';

/** Returns true when a Postgres URL is available for the test run. */
export const hasDatabaseUrl = (): boolean => Boolean(TEST_DATABASE_URL);

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

export const sampleTodo = {
  title: 'Buy milk',
  completed: false,
} as const;

export const sampleList = {
  name: 'Shopping',
} as const;

// ---------------------------------------------------------------------------
// HTTP helpers (use Node 18+ built-in fetch)
// ---------------------------------------------------------------------------

/** Resolves the base URL for a local ephemeral test server. */
export const testBaseUrl = (port: number): string =>
  `http://127.0.0.1:${port}`;

/** POST JSON to a test server and return the raw Response. */
export async function postJson(
  url: string,
  body: unknown,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** GET from a test server and return the raw Response. */
export async function getJson(url: string): Promise<Response> {
  return fetch(url);
}

// ---------------------------------------------------------------------------
// Dynamic-port server helper
// ---------------------------------------------------------------------------

import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

/**
 * Starts an HTTP server on a random OS-assigned port.
 * Returns `{ server, port, close }`.
 *
 * Use this in tests to avoid port collisions with stale processes:
 *
 * ```ts
 * const { port, close } = await startEphemeralServer(app);
 * afterAll(close);
 * ```
 */
export async function startEphemeralServer(
  handler: RequestHandler,
): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const server = createHttpServer(handler);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unexpected server address format');
  }

  const close = (): Promise<void> =>
    new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );

  return { server, port: address.port, close };
}
