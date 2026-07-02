import { type Route, sendJson } from '../http.js';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: (_req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  },
];

export default routes;

/** Named export required by S2-A contract. */
export function healthRouter(): Route[] {
  return routes;
}
