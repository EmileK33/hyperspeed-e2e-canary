/**
 * Integration test fixtures & helpers.
 *
 * Phase-safe: no imports from src/ feature modules — only node built-ins.
 * Each session's tests may import these utilities to spin up ephemeral servers,
 * make HTTP requests, and assert on responses.
 */
import http from 'node:http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestServer {
  server: http.Server;
  port: number;
  baseUrl: string;
  /** Gracefully close the server; resolves when the socket is released. */
  close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Start an ephemeral `node:http` server on an OS-assigned port (listen(0)).
 * Never uses a hard-coded port, so parallel test runs cannot collide.
 *
 * @example
 * const ts = await startTestServer((_req, res) => {
 *   res.writeHead(200); res.end('ok');
 * });
 * const res = await fetch(ts.baseUrl + '/ping');
 * await ts.close();
 */
export function startTestServer(
  handler: http.RequestListener,
): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);

    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const port = addr.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      const close = (): Promise<void> =>
        new Promise((res, rej) => {
          server.close((err) => (err ? rej(err) : res()));
        });

      resolve({ server, port, baseUrl, close });
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Thin wrapper around `fetch`; returns the raw Response. */
export async function httpGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, { headers });
}

export async function httpPost(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Assert status and parse JSON in one call. */
export async function expectJson(
  res: Response,
  status: number,
): Promise<unknown> {
  if (res.status !== status) {
    const text = await res.text();
    throw new Error(
      `Expected HTTP ${status} but got ${res.status}. Body: ${text}`,
    );
  }
  return res.json();
}
