/**
 * Authentication middleware.
 *
 * Provides a lightweight Bearer-token check suitable for the canary fixture.
 * When `AUTH_SECRET` is set the middleware validates a `Bearer <token>` header
 * against that secret; when absent every request is treated as authenticated
 * (open-dev mode).
 *
 * Route handlers that want auth-gating import `requireAuth` and call it at the
 * top of their handler body.
 */

import type { RouteContext, RouteResponse } from '../types/contracts.ts';

/** Extract the Bearer token from an Authorization header value, or null. */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? (match[1] ?? null) : null;
}

/**
 * Returns `true` when the token is considered valid.
 * Validation logic:
 *   - If `AUTH_SECRET` env var is absent → always valid (open-dev mode).
 *   - Otherwise the token must equal `AUTH_SECRET` exactly.
 *     (A real implementation would verify a signed JWT here.)
 */
export function isValidToken(token: string | null): boolean {
  const secret = process.env['AUTH_SECRET'];
  if (!secret) return true; // open-dev mode
  if (!token) return false;
  return token === secret;
}

/** 401 response body. */
const UNAUTHORIZED: RouteResponse = {
  status: 401,
  body: { error: 'Unauthorized', code: 'UNAUTHORIZED' },
};

/**
 * Guard helper — call at the start of any route handler that requires auth.
 * Returns a 401 `RouteResponse` when the request is unauthenticated, or
 * `null` when the caller should proceed.
 *
 * Usage:
 * ```ts
 * const denied = requireAuth(ctx);
 * if (denied) return denied;
 * ```
 */
export function requireAuth(
  ctx: RouteContext & { headers?: Record<string, string | undefined> }
): RouteResponse | null {
  const authHeader = ctx.headers?.['authorization'];
  const token = extractBearerToken(authHeader);
  if (!isValidToken(token)) return UNAUTHORIZED;
  return null;
}
