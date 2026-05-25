import type { IncomingMessage, ServerResponse } from 'node:http';

interface RouteMount {
  method: string;
  path: string;
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ) => void | Promise<void>;
}

export function healthRoute(startTime: number): RouteMount {
  return {
    method: 'GET',
    path: '/healthz',
    handler: (
      _req: IncomingMessage,
      res: ServerResponse,
      _params: Record<string, string>
    ): void => {
      const uptimeMs = Math.max(0, Date.now() - startTime);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptimeMs }));
    },
  };
}
