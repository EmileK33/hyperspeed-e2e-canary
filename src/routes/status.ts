/**
 * S2-C — Status route (US-006)
 *
 * GET /status → { version, uptimeSeconds, brandColor }
 *
 * AC-1: returns 200 with { version, uptimeSeconds }
 * AC-2: brandColor field contains the canary brand colour #3a86ff
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';

const startTime = Date.now();

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: async (_req, res) => {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      sendJson(res, 200, {
        version: '0.0.1',
        uptimeSeconds,
        brandColor: '#3a86ff',
      });
    },
  },
];

export default routes;

/**
 * statusRouter — registers the status routes with the shared route registry.
 * Called automatically on module import; also exported for explicit use.
 */
export function statusRouter(): void {
  registerRoutes(routes);
}

// Self-register on import so the server picks up the route automatically.
statusRouter();
