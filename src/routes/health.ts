/**
 * src/routes/health.ts — S2-A: Health probe (US-005)
 *
 * GET /health → 200 { status: "ok" }
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: async (_req, res, _params) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

// Self-register so importing this module mounts the route.
registerRoutes(routes);

/**
 * healthRouter — named export required by downstream sessions.
 * Returns the Route[] for the health probe.
 */
export function healthRouter(): Route[] {
  return routes;
}

export default routes;
