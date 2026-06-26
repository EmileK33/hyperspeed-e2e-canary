/**
 * Integration test fixtures.
 *
 * Provides helpers to spin up and tear down a real HTTP server for each
 * test suite, plus typed wrappers around fetch for common operations.
 */

import { createServer } from '../../src/server.ts';
import { healthRouter } from '../../src/routes/health.ts';
import { listsRouter } from '../../src/routes/lists.ts';
import { statusRouter } from '../../src/routes/status.ts';
import { todosRouter } from '../../src/routes/todos.ts';
import { resetStore, type Todo } from '../../src/store/todos.ts';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export type { Todo };

// ─── Server lifecycle ──────────────────────────────────────────────────────

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Start a test server on a random OS-assigned port.
 * Resets the in-memory store before each use.
 */
export async function startTestServer(): Promise<TestServer> {
  resetStore();

  const server: Server = createServer(
    healthRouter(),
    statusRouter(),
    todosRouter(),
    listsRouter(),
  );

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
  };
}

// ─── Typed fetch helpers ───────────────────────────────────────────────────

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as T;
  return { status: res.status, body: json };
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
};
