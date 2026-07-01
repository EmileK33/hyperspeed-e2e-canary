/**
 * Integration-test harness helpers.
 *
 * Provides:
 *  - `startServer(handler)`  — binds a node:http server on an ephemeral port
 *                              (port 0) and returns { url, port, close }.
 *  - `jsonFetch(url, init)`  — thin wrapper around fetch that sets JSON headers
 *                              and returns { status, body }.
 *
 * Design constraints (brief §"Independent Test"):
 *  - NEVER bind to a fixed port.  Always use createServer(0) / listen(0).
 *  - Phase-safe: no imports from feature sessions (store, routes, server).
 */

import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse, RequestListener } from 'node:http';

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export interface TestServer {
  /** The base URL, e.g. "http://127.0.0.1:54321" */
  url: string;
  /** The ephemeral TCP port the server is listening on. */
  port: number;
  /** Gracefully closes the server. */
  close(): Promise<void>;
}

/**
 * Start a lightweight HTTP test server on an ephemeral OS-assigned port.
 *
 * @param handler  A standard node:http RequestListener.
 * @returns        A {@link TestServer} with the resolved port and a close helper.
 */
export async function startServer(
  handler: RequestListener<typeof IncomingMessage, typeof ServerResponse>,
): Promise<TestServer> {
  const server = httpCreateServer(handler);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Unexpected server address type');
  }

  const { port } = addr;
  const url = `http://127.0.0.1:${port}`;

  const close = (): Promise<void> =>
    new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );

  return { url, port, close };
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

export interface FetchResult<T = unknown> {
  status: number;
  body: T;
}

/**
 * Perform a fetch against a test server, automatically setting JSON headers
 * and parsing the response body.
 */
export async function jsonFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<FetchResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...init, headers });

  let body: T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = (await res.json()) as T;
  } else {
    body = (await res.text()) as unknown as T;
  }

  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Database helpers (thin — connect only when DATABASE_URL is present)
// ---------------------------------------------------------------------------

/**
 * Returns true when the environment provides a DATABASE_URL, indicating that
 * Postgres integration tests can run.
 */
export function hasDatabaseUrl(): boolean {
  return typeof process.env['DATABASE_URL'] === 'string' &&
    process.env['DATABASE_URL'].trim().length > 0;
}
