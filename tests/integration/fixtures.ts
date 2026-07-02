/**
 * Integration test fixtures and helpers.
 *
 * Provides lightweight, phase-safe utilities for spinning up ephemeral
 * HTTP servers and making test requests. Does NOT import from src/ at
 * the top level — callers that need the real app should dynamically
 * import it so phase-0 smoke tests run before feature routes exist.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestServer {
  /** Base URL including scheme + host + ephemeral port, e.g. http://127.0.0.1:54321 */
  baseUrl: string;
  /** Gracefully stops the server and resolves when it's fully closed. */
  close: () => Promise<void>;
}

export interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Starts a raw `node:http` server on an ephemeral port (0) so test runs
 * never collide with each other or with a stale background process.
 *
 * @param handler  The request handler the server should use.
 */
export async function startTestServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);

    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      const close = (): Promise<void> =>
        new Promise((res, rej) =>
          server.close((err?: Error) => (err ? rej(err) : res())),
        );

      resolve({ baseUrl, close });
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Minimal fetch wrapper that captures status, headers, and raw body text.
 * Uses the built-in `fetch` available on Node ≥ 18.
 */
export async function testFetch(
  url: string,
  options?: RequestInit,
): Promise<TestResponse> {
  const response = await fetch(url, options);
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { status: response.status, headers, body };
}

/**
 * POST JSON helper: serialises `payload` and sets the correct content-type.
 */
export async function postJson(
  url: string,
  payload: unknown,
): Promise<TestResponse> {
  return testFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Phase-safe app loader
// ---------------------------------------------------------------------------

/**
 * Dynamically imports the real assembled app and wraps it in a TestServer.
 *
 * This helper is intentionally lazy (dynamic import) so that phase-0 smoke
 * tests that don't call it don't fail when `src/app.ts` hasn't been authored
 * yet by a feature session.
 *
 * Feature-wave integration tests call this; smoke.test.ts does NOT.
 *
 * The import path is expressed as a runtime string so TypeScript does not
 * attempt to resolve the module at type-check time (src/app.ts is seeded by
 * a different session and does not exist on the phase-0 base branch).
 */
export async function startAppServer(): Promise<TestServer> {
  // src/app.ts is seeded by a later feature session — it does not exist on the
  // phase-0 base branch. We suppress the module-resolution error here; the
  // import is only evaluated at runtime by feature-wave tests, never by
  // phase-0 smoke tests.
  // @ts-ignore TS2307
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appModule: any = await import('../../src/app.ts');
  const app: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void =
    typeof appModule.createApp === 'function'
      ? appModule.createApp()
      : appModule.default;
  return startTestServer(app);
}
