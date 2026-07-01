/**
 * Authentication middleware helpers.
 *
 * Wraps a RouteHandler to enforce token presence/validity before delegating.
 * The real JWT verification would live here in production; this scaffold
 * provides the interface and the pass-through/rejection logic so feature
 * sessions can use requireAuth() without knowing the implementation.
 */

import type { RouteHandler, RouteContext, ApiResponse } from '../types/contracts.ts';

export interface AuthOptions {
  /** When true, return 401 if no Authorization header is present. */
  required: boolean;
}

/** Shape attached to the context after successful auth (future extension). */
export interface AuthContext {
  userId: string;
  token: string;
}

/**
 * Wrap a handler with optional authentication enforcement.
 *
 * @param handler  The downstream route handler.
 * @param options  Auth options (defaults to not required).
 */
export function withAuth(
  handler: RouteHandler,
  options: AuthOptions = { required: false }
): RouteHandler {
  return async (ctx: RouteContext): Promise<ApiResponse> => {
    const rawHeader =
      ctx.headers['authorization'] ?? ctx.headers['Authorization'];
    const authHeader =
      typeof rawHeader === 'string' ? rawHeader : rawHeader?.[0] ?? '';

    if (options.required && !authHeader) {
      return {
        status: 401,
        body: { error: 'Authorization required', code: 'UNAUTHORIZED' },
      };
    }

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        return {
          status: 401,
          body: {
            error: 'Authorization header must use Bearer scheme',
            code: 'INVALID_AUTH_SCHEME',
          },
        };
      }
      const token = authHeader.slice(7).trim();
      if (!token) {
        return {
          status: 401,
          body: { error: 'Bearer token is empty', code: 'EMPTY_TOKEN' },
        };
      }
    }

    return handler(ctx);
  };
}

/**
 * Convenience wrapper: require a valid Bearer token or return 401.
 */
export function requireAuth(handler: RouteHandler): RouteHandler {
  return withAuth(handler, { required: true });
}

/**
 * Convenience wrapper: accept the request whether or not a token is present.
 */
export function optionalAuth(handler: RouteHandler): RouteHandler {
  return withAuth(handler, { required: false });
}
