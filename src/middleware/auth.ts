// Auth middleware — shared scaffold, owned by S0-A.
// Provides a lightweight token-based guard that route handlers can
// opt into.  Not enforced on any route in this fixture project, but
// exported so feature sessions can apply it when needed.

import type { ServerResponse } from 'node:http';
import { sendJson, type RouteHandler, type RouteRequest } from '../http.js';

/**
 * Read the Bearer token from the Authorization header.
 * Returns the token string, or undefined if absent / malformed.
 */
export function extractBearerToken(req: RouteRequest): string | undefined {
  const header = req.headers['authorization'] ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}

/**
 * Wrap a route handler so it requires a valid Bearer token.
 *
 * `validTokens` is the set of accepted tokens (resolved at call time so
 * tests can pass an in-memory set without touching process.env).
 *
 * If no valid token is presented the handler sends 401 and returns early.
 */
export function requireAuth(
  validTokens: ReadonlySet<string>,
  handler: RouteHandler,
): RouteHandler {
  return async (req: RouteRequest, res: ServerResponse): Promise<void> => {
    const token = extractBearerToken(req);
    if (!token || !validTokens.has(token)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    await handler(req, res);
  };
}

/**
 * Convenience factory that reads the accepted token from API_TOKEN env var.
 * If API_TOKEN is unset every request is rejected with 401.
 */
export function envAuth(handler: RouteHandler): RouteHandler {
  return async (req: RouteRequest, res: ServerResponse): Promise<void> => {
    const envToken = process.env['API_TOKEN'];
    const valid: ReadonlySet<string> = envToken ? new Set([envToken]) : new Set();
    await requireAuth(valid, handler)(req, res);
  };
}
