// Application factory — assembles routers and middleware into a request handler.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { authMiddleware } from './middleware/auth.ts';
import { healthRouter, listsRouter, statusRouter, todosRouter, type Router } from './routes/index.ts';

function matchRouter(routers: Router[], url: string): Router | undefined {
  return routers.find(r => url === r.prefix || url.startsWith(r.prefix + '/') || url.startsWith(r.prefix + '?'));
}

/** Build and return the application request handler. */
export function createApp() {
  const routers: Router[] = [
    healthRouter(),
    statusRouter(),
    todosRouter(),
    listsRouter(),
  ];

  return function handler(req: IncomingMessage, res: ServerResponse): void {
    authMiddleware(req, res, () => {
      const url = req.url ?? '/';
      const router = matchRouter(routers, url);
      if (router) {
        void Promise.resolve(router.handle(req, res));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      }
    });
  };
}
