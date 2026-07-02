// S2-C: GET /status — US-006
import { type Route, sendJson } from '../http.js';
import type { StatusBody } from '../types/contracts.js';

const startedAt = Date.now();

/** Exported function symbol required by contracts. */
export function statusRouter(): Route[] {
  return routes;
}

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: (_req, res) => {
      const body: StatusBody = {
        version: '0.0.1',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        brandColor: '#6366f1',
      };
      sendJson(res, 200, body);
    },
  },
];

export default routes;
