import type http from 'node:http';
import type { RouteHandler } from '../server/app.ts';
import { sendJson } from '../server/app.ts';

const BRAND_COLOR = '#3a86ff';
const VERSION = process.env.npm_package_version ?? '0.0.1';

/** Route handler for the operator status surface (US-006). */
export function statusRouter(): RouteHandler {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> => {
    if (req.method === 'GET' && req.url === '/status') {
      sendJson(res, 200, {
        version: VERSION,
        uptimeSeconds: Math.floor(process.uptime()),
        brandColor: BRAND_COLOR,
      });
      return true;
    }
    return false;
  };
}
