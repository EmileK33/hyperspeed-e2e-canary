import { type Route, sendJson } from '../http.js';

const startTime = Date.now();

/** Named export required by contract. */
export function statusRouter(): Route[] {
  return routes;
}

const routes: Route[] = [
  {
    method: 'GET',
    path: '/status',
    handler: (_req, res) => {
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
