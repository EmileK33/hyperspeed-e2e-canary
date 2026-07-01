/**
 * Status route — US-006
 * GET /status → { status: "ok", timestamp: <ISO-8601> }
 * S2-C: status
 */

import { type Route, sendJson } from '../http.js';
import { registerRoutes } from './index.js';

/**
 * Returns the array of routes handled by this module.
 * Exported as `statusRouter` per the session contract.
 */
export function statusRouter(): Route[] {
  return routes;
}

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: async (_req, res) => {
      sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    },
  },
];

// Auto-register into the global route registry when this module is imported.
registerRoutes(routes);

export default routes;
