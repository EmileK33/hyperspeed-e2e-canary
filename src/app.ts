/**
 * Application server factory.
 *
 * Creates a node:http server that:
 *  1. Parses JSON request bodies.
 *  2. Runs the auth middleware chain.
 *  3. Dispatches to the route registry.
 *  4. Returns 404 JSON for unknown routes.
 *
 * Route modules are registered via the shared RouteRegistry in
 * src/routes/index.ts; this file never needs editing to mount a route.
 */

import { createServer as httpCreateServer, type Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { authMiddleware } from './middleware/auth.ts';
import { registry } from './routes/index.ts';
import type { AppRequest } from './types/contracts.ts';

// ── JSON helpers ─────────────────────────────────────────────────

/** Read the full request body as a string. */
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Send a JSON response. */
export function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ── Request handler ──────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';

  // Parse JSON body if present
  const appReq = req as AppRequest;
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    try {
      const raw = await readBody(req);
      appReq.body = raw ? JSON.parse(raw) : undefined;
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }
  }

  // Auth middleware → route dispatch
  authMiddleware(req, res, async () => {
    const match = registry.match(method, url);
    if (!match) {
      json(res, 404, { error: 'Route not found' });
      return;
    }

    appReq.params = match.params;
    try {
      await match.route.handler(appReq, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      json(res, 500, { error: message });
    }
  });
}

// ── Factory ──────────────────────────────────────────────────────

/** Create and return a configured HTTP server (not yet listening). */
export function createServer(): Server {
  return httpCreateServer(handleRequest);
}
