/**
 * Health route — US-005.
 *
 * GET /health → 200 { status: "ok" }
 */

import { type Route, type AppRequest } from '../server/app.js';
import type { ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: (_req: AppRequest, res: ServerResponse) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

/**
 * Register health routes on an app's `addRoutes` function.
 *
 * @example
 * ```ts
 * import { createServer } from '../server/app.js';
 * import { healthRouter } from './health.js';
 * const app = createServer();
 * healthRouter(app.addRoutes);
 * ```
 */
export function healthRouter(addRoutes: (routes: Route[]) => void): void {
  addRoutes(routes);
}

/** Auto-discovery default export (consumed by src/routes/index.ts). */
export default routes;
