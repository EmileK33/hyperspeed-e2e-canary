/**
 * Server entry point.
 *
 * Boots a node:http server that delegates to the App dispatcher created by
 * src/app.ts. Import all route modules before calling listen() so the
 * registry in src/routes/index.ts is fully populated.
 *
 * Usage (from the project root):
 *   npx tsx src/server.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createApp } from './app.ts';
import { PORT } from './lib/env.ts';

/** Parse the raw request body as JSON; return undefined on empty / parse errors. */
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}

/** Collect request headers into a plain object. */
function normaliseHeaders(
  raw: IncomingMessage['headers']
): Record<string, string | string[] | undefined> {
  return raw as Record<string, string | string[] | undefined>;
}

/**
 * Create and return the HTTP server (does not call listen()).
 * Exported so integration tests can grab the instance without binding a port.
 */
export function buildServer() {
  const app = createApp();

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const method = req.method ?? 'GET';
      const url = req.url ?? '/';
      const body = await parseBody(req);
      const headers = normaliseHeaders(req.headers);

      const response = await app.handle(method, url, body, headers);

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = response.status;
      res.end(JSON.stringify(response.body));
    }
  );

  return { server, app };
}

/**
 * Start listening on the configured PORT.
 * Called automatically when this file is run directly.
 */
export function listen(port: number = PORT): Promise<void> {
  return new Promise((resolve) => {
    const { server } = buildServer();
    server.listen(port, () => {
      console.log(`[server] Listening on http://localhost:${port}`);
      resolve();
    });
  });
}

// Auto-start when run as main module.
// `import.meta.url` pattern works with tsx / ts-node in ESM mode.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));

if (isMain) {
  listen().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  });
}
