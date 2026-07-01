/**
 * Health route — US-005
 * GET /health → 200 { status: "ok" }
 * S2-A: health
 */

import { type Route, sendJson } from '../http.js';
import { registerRoutes } from './index.js';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: (_req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

// Self-register so the global registry picks this up when the module is imported.
registerRoutes(routes);

/**
 * Returns the health routes.
 * Other sessions may import this to mount health routes explicitly.
 */
export function healthRouter(): Route[] {
  return routes;
}

export default routes;
