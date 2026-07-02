/**
 * tests/integration/fixtures.ts
 *
 * Harness helpers for the integration suite. Phase-safe: all helpers degrade
 * gracefully when a database is unavailable (DATABASE_URL not set) or when no
 * feature routes have been merged yet. Nothing in this file assumes any specific
 * route is mounted.
 */

import http from 'node:http';
import { createServer } from '../../src/app.js';

// ---------------------------------------------------------------------------
// Test-server fixture
// ---------------------------------------------------------------------------

export interface TestServer {
  /** The raw node:http Server instance. */
  server: http.Server;
  /** Ephemeral port assigned by the OS (never 0 after listen). */
  port: number;
  /** Convenience base URL, e.g. "http://localhost:54321". */
  baseUrl: string;
  /** Close the server and wait for all connections to drain. */
  close(): Promise<void>;
}

/**
 * Start the application server on an ephemeral OS-assigned port (listen(0)).
 * Calling `server.close()` from the returned handle tears it down cleanly.
 * Safe to call before any feature routes exist — createServer() auto-discovers
 * whatever is present and returns an empty router otherwise.
 */
export async function startTestServer(): Promise<TestServer> {
  const server = await createServer();

  return new Promise((resolve, reject) => {
    server.on('error', reject);

    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('startTestServer: could not determine bound port'));
      }

      const port = addr.port;
      const baseUrl = `http://localhost:${port}`;

      resolve({
        server,
        port,
        baseUrl,
        close(): Promise<void> {
          return new Promise((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          );
        },
      });
    });
  });
}

/**
 * Make a JSON request against a running TestServer.
 * Returns `{ status, body }` — never throws on HTTP-level errors.
 */
export async function jsonRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (payload) headers['content-length'] = Buffer.byteLength(payload).toString();

  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8').trim();
          let parsed: unknown;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/** Returns true when a DATABASE_URL is present in the environment. */
export function hasDatabase(): boolean {
  return typeof process.env['DATABASE_URL'] === 'string' && process.env['DATABASE_URL'].length > 0;
}

/** The DATABASE_URL string, or undefined when not configured. */
export function getDatabaseUrl(): string | undefined {
  return process.env['DATABASE_URL'] || undefined;
}

/**
 * Open a single `pg.Client` connected to DATABASE_URL, run `fn`, then release
 * the client — even on error. Resolves `null` and skips silently when
 * DATABASE_URL is absent or `pg` cannot be imported (Phase 0 environment).
 */
export async function withDbClient<T>(
  fn: (client: import('pg').Client) => Promise<T>,
): Promise<T | null> {
  const url = getDatabaseUrl();
  if (!url) return null;

  let pgMod: typeof import('pg') | undefined;
  try {
    pgMod = (await import('pg')) as typeof import('pg');
  } catch {
    return null; // pg not installed yet
  }

  const client = new pgMod.default.Client({ connectionString: url });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}
