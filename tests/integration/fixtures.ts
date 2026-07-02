/**
 * Integration test fixtures — Phase 0 harness.
 *
 * Exports lightweight helpers for spinning up an ephemeral test server (port 0)
 * and making JSON requests against it.  Phase-safe: works before any feature
 * routes exist and requires no external services.
 *
 * Future waves add DB-pool helpers here; this base only covers HTTP.
 */

import http from 'node:http';
import { createServer } from '../../src/app.js';

// ─── Server fixture ──────────────────────────────────────────────────────────

export interface TestServer {
  /** The underlying node:http Server instance. */
  server: http.Server;
  /** The OS-assigned port the server is listening on. */
  port: number;
  /** Convenience base URL, e.g. "http://localhost:54321". */
  baseUrl: string;
}

/**
 * Build and start the app server on an ephemeral port (port 0).
 * Each call returns a completely independent server instance so tests
 * cannot collide with each other or with a stale listener.
 */
export async function startTestServer(): Promise<TestServer> {
  const server = await createServer();
  return new Promise<TestServer>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        server,
        port: addr.port,
        baseUrl: `http://localhost:${addr.port}`,
      });
    });
  });
}

/**
 * Gracefully close a test server.  Resolves once all existing connections
 * have been drained (the `server.close` callback fires).
 */
export async function stopTestServer(server: http.Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export interface JsonResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

/**
 * Perform an HTTP request against a test server and parse the JSON response.
 * Never throws on non-2xx; returns the status + parsed body so tests can
 * assert on error shapes too.
 */
export async function jsonRequest<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<JsonResponse<T>> {
  const hasBody = body !== undefined;
  const res = await fetch(`${baseUrl}${path}`, {
    method: method.toUpperCase(),
    headers: hasBody ? { 'content-type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null as unknown as T;
  }

  return { status: res.status, headers, data };
}

/**
 * Convenience: GET request.
 */
export const get = <T = unknown>(
  baseUrl: string,
  path: string,
) => jsonRequest<T>(baseUrl, 'GET', path);

/**
 * Convenience: POST request with a JSON body.
 */
export const post = <T = unknown>(
  baseUrl: string,
  path: string,
  body: unknown,
) => jsonRequest<T>(baseUrl, 'POST', path, body);

/**
 * Convenience: PATCH request with a JSON body.
 */
export const patch = <T = unknown>(
  baseUrl: string,
  path: string,
  body: unknown,
) => jsonRequest<T>(baseUrl, 'PATCH', path, body);

/**
 * Convenience: DELETE request.
 */
export const del = <T = unknown>(
  baseUrl: string,
  path: string,
) => jsonRequest<T>(baseUrl, 'DELETE', path);
