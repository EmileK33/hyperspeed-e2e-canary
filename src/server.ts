/**
 * HTTP server factory.
 * S0-B: stub — S1-A will own this file and replace with the full implementation.
 */

import { createServer as httpCreateServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type RouterFn = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void | Promise<void>;

/** Compose multiple routers into a single request handler (first match wins). */
function compose(routers: RouterFn[]) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let idx = 0;
    const next = async () => {
      if (idx >= routers.length) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      const router = routers[idx++];
      await router(req, res, next);
    };
    await next();
  };
}

/**
 * Create and return an HTTP server wired with all route handlers.
 * Callers are responsible for calling server.listen(port).
 */
export function createServer(...routers: RouterFn[]): Server {
  const handler = compose(routers);
  return httpCreateServer(handler);
}
