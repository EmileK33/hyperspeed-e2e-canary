/**
 * Health route — GET /health
 *
 * US-005: Returns a 200 JSON response indicating the service is up.
 * Self-registers on import via registerRoutes so the route table is
 * populated whenever this module is imported by the server or tests.
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: async (_req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

// Self-register when this module is first imported.
registerRoutes(routes);

/**
 * healthRouter — registers the health routes with the shared route registry
 * and returns the registered Route array.
 */
export function healthRouter(): Route[] {
  // Routes are already registered on module load; this function exposes them
  // for callers that need a reference or want to re-register after clearRoutes().
  registerRoutes(routes);
  return routes;
}

export default routes;
