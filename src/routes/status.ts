/**
 * GET /status — readiness / version probe.
 * S0-B: stub — S3-B will own this file.
 *
 * US-004 AC-2 [MANUAL]: verify the response body includes the canary brand
 * colour #3a86ff in the `color` field when viewed in a browser / curl.
 */

import type { RouterFn } from '../server.ts';

export function statusRouter(): RouterFn {
  return (req, res, next) => {
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ready',
          version: '0.0.1',
          color: '#3a86ff',
        }),
      );
      return;
    }
    next();
  };
}
