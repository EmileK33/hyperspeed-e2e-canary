/**
 * Authentication middleware.
 * Provides a composable middleware type and a no-op implementation
 * for unauthenticated routes / canary fixtures.
 * S0-A: Shared scaffold / infrastructure
 */

import type { IncomingRequest, ServerResponse } from '../types/contracts.ts';

/** Advance to the next handler in a middleware chain. */
export type NextFn = () => void | Promise<void>;

/** Framework-free middleware signature. */
export type Middleware = (
  req: IncomingRequest,
  res: ServerResponse,
  next: NextFn
) => void | Promise<void>;

/**
 * Factory that creates a configurable auth middleware.
 * Current implementation is a pass-through; extend to check
 * Bearer tokens, API keys, etc.
 */
export function createAuthMiddleware(
  _options: { secret?: string } = {}
): Middleware {
  return async (_req, _res, next) => {
    // TODO: validate credentials against _options.secret
    await next();
  };
}

/** A no-op middleware that always calls next — useful for open routes. */
export const noopAuth: Middleware = (_req, _res, next) => next();

/**
 * Compose multiple middlewares into a single one that runs them in order.
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return async (req, res, next) => {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const fn = i < middlewares.length ? middlewares[i] : next;
      await fn(req, res, () => dispatch(i + 1));
    }

    await dispatch(0);
  };
}
