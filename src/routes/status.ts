/**
 * src/routes/status.ts — S2-C: status endpoint (US-006)
 *
 * Implements `GET /status` — a simple health-check that returns the
 * current server status and UTC timestamp.
 *
 * Registers itself into the shared route registry as a side-effect on import
 * so the pre-seeded `src/app.ts` dispatcher picks it up automatically.
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: async (_req, res, _params) => {
      sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    },
  },
];

// Self-register into the shared registry on import.
registerRoutes(routes);

// Default export — the Route[] array (convention for route modules).
export default routes;

// ---------------------------------------------------------------------------
// Named export — `statusRouter` (required by contract consumers)
// ---------------------------------------------------------------------------

/**
 * Returns the routes registered by this module.
 * Provided as a named export so other sessions can import { statusRouter }.
 */
export function statusRouter(): Route[] {
  return routes;
}
