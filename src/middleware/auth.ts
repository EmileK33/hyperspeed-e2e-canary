/**
 * Auth middleware.
 * In this canary fixture every request is treated as authenticated;
 * the module exists so downstream sessions can import and extend it.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export type Next = () => void | Promise<void>;

export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: Next,
) => void | Promise<void>;

/**
 * Pass-through auth middleware.
 * Replace with real token/session validation for production use.
 */
export const authMiddleware: Middleware = (
  _req: IncomingMessage,
  _res: ServerResponse,
  next: Next,
): void => {
  next();
};

/**
 * Compose an ordered list of middleware into a single middleware.
 * Each middleware must call `next()` to continue the chain.
 */
export function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return async (req, res, next) => {
    let index = 0;

    const run = async (): Promise<void> => {
      const mw = middlewares[index++];
      if (mw) {
        await mw(req, res, run);
      } else {
        await next();
      }
    };

    await run();
  };
}
