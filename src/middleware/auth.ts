/**
 * Authentication middleware.
 *
 * For the Canary Todos API the auth story is kept deliberately simple:
 * requests carry an optional `Authorization: Bearer <token>` header.
 * The middleware validates the token and attaches a minimal principal to
 * the request context — or rejects with 401 when a protected route is hit
 * without valid credentials.
 *
 * Future sessions can expand the token-validation logic without changing
 * the public interface exported here.
 */

import type { AppRequest, AppResponse } from '../types/contracts.ts';

/** Minimal representation of the authenticated caller. */
export interface Principal {
  /** Raw token string extracted from the Authorization header. */
  token: string;
}

/**
 * Extract the Bearer token from an Authorization header value.
 * Returns `null` if the header is absent or not a valid Bearer scheme.
 */
export function extractBearerToken(
  authHeader: string | string[] | undefined,
): string | null {
  if (!authHeader) return null;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Validate a raw token string.
 * Returns a `Principal` on success or `null` if the token is invalid.
 *
 * Currently accepts any non-empty token (the canary fixture has no real
 * auth backend). Replace this function to plug in real validation.
 */
export function validateToken(token: string): Principal | null {
  return token.length > 0 ? { token } : null;
}

/**
 * Middleware that enforces authentication.
 *
 * Usage — call inside a route handler to guard it:
 * ```ts
 * const principal = requireAuth(req, res);
 * if (!principal) return; // response already sent
 * ```
 *
 * @returns The `Principal` on success, or `null` after writing a 401 response.
 */
export function requireAuth(
  req: AppRequest,
  res: AppResponse,
): Principal | null {
  const token = extractBearerToken(req.headers['authorization']);
  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized: missing Bearer token' }));
    return null;
  }

  const principal = validateToken(token);
  if (!principal) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized: invalid token' }));
    return null;
  }

  return principal;
}
