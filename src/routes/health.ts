import type http from 'node:http';
import type { RouteHandler } from '../server/app.ts';
import { sendJson } from '../server/app.ts';

/** Route handler for the liveness health probe (US-005). */
export function healthRouter(): RouteHandler {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return true;
    }
    return false;
  };
}
