/**
 * Status route — US-006.
 *
 * GET /status → 200 { status: "ok" }
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
    path: '/status',
    handler: (_req: AppRequest, res: ServerResponse) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

/**
 * Register status routes on an app's `addRoutes` function.
 *
 * @example
 * ```ts
 * import { createServer } from '../server/app.js';
 * import { statusRouter } from './status.js';
 * const app = createServer();
 * statusRouter(app.addRoutes);
 * ```
 */
export function statusRouter(addRoutes: (routes: Route[]) => void): void {
  addRoutes(routes);
}

/** Auto-discovery default export (consumed by src/routes/index.ts). */
export default routes;
