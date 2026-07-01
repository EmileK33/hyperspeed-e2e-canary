/**
 * HTTP server bootstrap — US-002.
 *
 * `createServer()` builds a framework-free node:http server with:
 *   - JSON body parsing
 *   - Simple method + path route dispatch (supports `:param` segments)
 *   - 404 JSON fallback for unknown routes
 *
 * Downstream route sessions (Phase 2+) pass their Route[] into createServer
 * or register them on the returned app via `app.addRoutes()`.
 */

import {
  createServer as httpCreateServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A parsed request with JSON body attached. */
export interface AppRequest extends IncomingMessage {
  /** Parsed JSON body (undefined if the request had no body). */
  body?: unknown;
  /** Path parameters extracted from the URL pattern, e.g. { id: "42" }. */
  params?: Record<string, string>;
}

/** A single route descriptor. */
export interface Route {
  /** HTTP method (case-insensitive), e.g. "GET", "POST". */
  method: string;
  /**
   * URL path pattern.  Supports static segments and named parameters
   * prefixed with `:`, e.g. `/todos/:id/toggle`.
   */
  path: string;
  /** Async-friendly handler — may return a Promise or be synchronous. */
  handler: (req: AppRequest, res: ServerResponse) => Promise<void> | void;
}

/** The value returned by `createServer()`. */
export interface App {
  /** The underlying node:http server — call `.listen()` to start it. */
  server: Server;
  /** Register additional routes after construction. */
  addRoutes: (routes: Route[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read and parse the request body as JSON.  Returns undefined on failure. */
async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}

/**
 * Convert a route path pattern to a RegExp and capture group names.
 *
 * `/todos/:id/toggle`  →  /^\/todos\/([^/]+)\/toggle\/?$/  with params ["id"]
 */
function compilePath(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = pattern
    .replace(/\//g, '\/')           // escape slashes
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
      paramNames.push(name);
      return '([^/]+)';
    });
  return {
    regex: new RegExp(`^${regexStr}\/?$`),
    paramNames,
  };
}

/** Send a JSON response. */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// createServer
// ---------------------------------------------------------------------------

/**
 * Create a configured HTTP app with JSON body parsing and route dispatch.
 *
 * @param initialRoutes  Optional initial set of routes to register.
 * @returns An `App` object containing the raw `server` and `addRoutes()`.
 *
 * @example
 * ```ts
 * const app = createServer([
 *   { method: 'GET', path: '/health', handler: (_req, res) => sendJson(res, 200, { status: 'ok' }) },
 * ]);
 * app.server.listen(3000);
 * ```
 */
export function createServer(initialRoutes: Route[] = []): App {
  // Mutable route table — compiled once on registration.
  const table: Array<Route & { regex: RegExp; paramNames: string[] }> = [];

  function addRoutes(routes: Route[]): void {
    for (const route of routes) {
      const { regex, paramNames } = compilePath(route.path);
      table.push({ ...route, regex, paramNames });
    }
  }

  // Register any initial routes.
  addRoutes(initialRoutes);

  const server = httpCreateServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Parse JSON body unconditionally — handlers decide whether to use it.
    const body = await parseJsonBody(req);
    const appReq = req as AppRequest;
    appReq.body = body;

    const method = (req.method ?? 'GET').toUpperCase();
    const rawUrl = req.url ?? '/';
    const url = rawUrl.split('?')[0]; // strip query string

    // Walk the route table in registration order.
    for (const entry of table) {
      if (entry.method.toUpperCase() !== method) continue;
      const match = entry.regex.exec(url);
      if (!match) continue;

      // Extract named params.
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      appReq.params = params;

      try {
        await entry.handler(appReq, res);
      } catch (err) {
        // Surface unhandled handler errors as 500.
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: err instanceof Error ? err.message : 'Internal server error',
          });
        }
      }
      return;
    }

    // No matching route → 404 JSON.
    sendJson(res, 404, { error: 'Route not found' });
  });

  return { server, addRoutes };
}
