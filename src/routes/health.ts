/**
 * GET /health — liveness probe.
 * S0-B: stub — S3-A will own this file.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RouterFn } from '../server.ts';

export function healthRouter(): RouterFn {
  return (req, res, next) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    next();
  };
}
