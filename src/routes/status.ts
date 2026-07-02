// Route module for GET /status — US-006.
// Owned by Session S2-C. Auto-discovered by src/routes/index.ts.
import { type Route, sendJson } from '../http.js';
import type { StatusResponse } from '../types/contracts.js';

const startTime = Date.now();

/** Named export required by the session contract. */
export function statusRouter(): Route[] {
  return routes;
}

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: (_req, res) => {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      const body: StatusResponse = {
        version: '1.0.0',
        uptimeSeconds,
        brandColor: '#7C3AED',
      };
      sendJson(res, 200, body);
    },
  },
];

export default routes;
