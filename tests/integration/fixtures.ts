/**
 * Integration-test harness fixtures.
 *
 * Provides helpers to spin up the real app server on an **ephemeral port**
 * (port 0) and tear it down cleanly.  Phase-safe: the server uses
 * auto-discovery (src/routes/index.ts) so it boots correctly at Phase 0
 * with zero feature routes loaded and at Phase N with all routes mounted.
 *
 * Usage in a test file:
 *
 *   import { startServer, stopServer, request } from './fixtures.js';
 *   let handle: ServerHandle;
 *   beforeAll(async () => { handle = await startServer(); });
 *   afterAll(async () => { await stopServer(handle); });
 *   it('...', async () => { const res = await request(handle, 'GET', '/health'); });
 */

import http from 'node:http';
import { createServer } from '../../src/app.js';

// ─── Server handle ────────────────────────────────────────────────────────────

export interface ServerHandle {
  server: http.Server;
  /** The OS-assigned port (always > 0 after startServer resolves). */
  port: number;
  /** Convenience base URL, e.g. "http://127.0.0.1:54321". */
  baseUrl: string;
}

/**
 * Build and start the app server on an ephemeral port.
 * Resolves once the server is ready to accept connections.
 */
export async function startServer(): Promise<ServerHandle> {
  const server = await createServer();
  return new Promise<ServerHandle>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        server,
        port: addr.port,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

/**
 * Gracefully close a server returned by startServer.
 * Resolves once all connections are closed.
 */
export async function stopServer(handle: ServerHandle): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    handle.server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── HTTP request helper ──────────────────────────────────────────────────────

export interface TestResponse {
  /** HTTP status code. */
  status: number;
  /** Parsed JSON body (or raw string if the body is not valid JSON). */
  body: unknown;
  /** Raw response headers. */
  headers: http.IncomingHttpHeaders;
}

/**
 * Make an HTTP request against a running ServerHandle.
 *
 * @param handle   The ServerHandle returned by startServer.
 * @param method   HTTP verb ("GET", "POST", …).
 * @param path     Path + optional query string, e.g. "/todos?done=false".
 * @param body     Optional JSON-serialisable request body.
 */
export async function request(
  handle: ServerHandle,
  method: string,
  path: string,
  body?: unknown,
): Promise<TestResponse> {
  return new Promise<TestResponse>((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: handle.port,
      path,
      method: method.toUpperCase(),
      headers: {
        ...(payload !== undefined
          ? {
              'content-type': 'application/json',
              'content-length': String(Buffer.byteLength(payload)),
            }
          : {}),
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk as Buffer));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        let parsed: unknown;
        try {
          parsed = raw ? JSON.parse(raw) : undefined;
        } catch {
          parsed = raw;
        }
        resolve({
          status: res.statusCode ?? 0,
          body: parsed,
          headers: res.headers,
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

// Node types for AddressInfo — pull in without a full @types/node import so
// this file compiles under either strict or loose tsconfig.
import type * as net from 'node:net';
