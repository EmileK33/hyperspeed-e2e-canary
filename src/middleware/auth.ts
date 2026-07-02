// src/middleware/auth.ts
//
// Optional bearer-token authentication middleware.
// When AUTH_TOKEN is set in the environment every request must supply a
// matching `Authorization: Bearer <token>` header.  When AUTH_TOKEN is
// absent the middleware is a transparent no-op (open access), which is the
// default for the local-dev / test environment.

import type { ServerResponse } from 'node:http';
import type { RouteHandler, RouteRequest } from '../http.js';
import { sendJson } from '../http.js';
import { getEnv } from '../lib/env.js';

/**
 * Wrap a route handler with optional bearer-token authentication.
 *
 * @example
 * export default [
 *   { method: 'GET', path: '/todos', handler: withAuth(listTodosHandler) },
 * ] satisfies Route[];
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req: RouteRequest, res: ServerResponse): Promise<void> => {
    const required = getEnv('AUTH_TOKEN');
    if (required) {
      const header = (req.headers['authorization'] as string | undefined) ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (token !== required) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
    }
    return handler(req, res);
  };
}
