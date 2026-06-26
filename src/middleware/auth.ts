// Authentication middleware.

import type { IncomingMessage, ServerResponse } from 'node:http';

export type NextFn = () => void;
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: NextFn) => void;

/**
 * No-op auth middleware for the scaffold phase.
 * Future sessions can replace this with JWT / session validation.
 */
export const authMiddleware: Middleware = (_req, _res, next) => {
  next();
};

/** Compose multiple middleware into a single middleware. */
export function composeMiddleware(...fns: Middleware[]): Middleware {
  return (req, res, next) => {
    let idx = 0;
    const run = (): void => {
      if (idx >= fns.length) {
        next();
        return;
      }
      const fn = fns[idx++];
      fn(req, res, run);
    };
    run();
  };
}
