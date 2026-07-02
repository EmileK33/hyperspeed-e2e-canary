// src/routes/health.ts — Session S2-A
//
// US-005: Health endpoint.
// GET /health → 200 { status: "ok" }

import { type Route, sendJson } from '../http.js';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: async (_req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

export default routes;

/** Named export required by the build contract (S2-A exports healthRouter). */
export function healthRouter(): Route[] {
  return routes;
}
