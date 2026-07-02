// Bearer-token auth middleware — owned by S0-A (Phase 0).
// Wraps any route handler with optional authentication. When the AUTH_TOKEN
// env var is set the handler is protected and requires a matching
// "Authorization: Bearer <token>" header. When AUTH_TOKEN is unset the
// wrapper is a transparent pass-through (useful for local dev / tests).

import { sendJson, type RouteHandler } from '../http.js';

/**
 * Wrap a RouteHandler with optional Bearer-token authentication.
 *
 * Behaviour:
 *  - AUTH_TOKEN unset → handler is called unconditionally (no auth check).
 *  - AUTH_TOKEN set   → checks `Authorization: Bearer <value>`; returns 401
 *    JSON if the header is missing or the token does not match.
 *
 * Usage:
 *   const routes: Route[] = [
 *     { method: 'GET', path: '/todos', handler: withAuth(listTodos) },
 *   ];
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req, res) => {
    const requiredToken = process.env['AUTH_TOKEN'];
    if (requiredToken) {
      const authHeader = (req.headers['authorization'] as string | undefined) ?? '';
      const provided = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : '';
      if (provided !== requiredToken) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
    }
    return handler(req, res);
  };
}

/**
 * Extract the bearer token from a request, or return undefined.
 * Useful for handlers that want to inspect the token without blocking.
 */
export function extractBearer(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const authHeader = req.headers['authorization'];
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw?.startsWith('Bearer ')) return undefined;
  return raw.slice('Bearer '.length).trim() || undefined;
}
