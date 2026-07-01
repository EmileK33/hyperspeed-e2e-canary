/**
 * Authentication middleware for node:http servers.
 *
 * Validates a Bearer token from the Authorization header and attaches
 * an AuthContext to the request object.  Routes that require auth call
 * `requireAuth()` as a guard.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthContext } from '../types/contracts.ts';

/** Extend IncomingMessage with our auth context. */
export interface AuthedRequest extends IncomingMessage {
  auth?: AuthContext;
}

/**
 * Extract and validate a Bearer token from the Authorization header.
 * Returns the token string, or null if absent / malformed.
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers['authorization'] ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Attach an `auth` context to the request.
 * In production you would verify a JWT here; for the canary fixture
 * we accept any non-empty token and use it as the userId.
 */
export function attachAuth(req: AuthedRequest): void {
  const token = extractBearerToken(req);
  req.auth = token ? { userId: token } : {};
}

/**
 * Middleware that requires a valid auth context.
 * Writes a 401 JSON response and returns `false` if auth is missing.
 * Returns `true` if the caller may proceed.
 */
export function requireAuth(
  req: AuthedRequest,
  res: ServerResponse
): boolean {
  attachAuth(req);
  if (!req.auth?.userId) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}
