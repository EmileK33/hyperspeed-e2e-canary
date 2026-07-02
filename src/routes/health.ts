// Session S2-A — health route (US-005)
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

/** Named export required by session contracts. */
export function healthRouter(): Route[] {
  return routes;
}
