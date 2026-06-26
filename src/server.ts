// HTTP server factory.

import { createServer as nodeCreateServer, type Server } from 'node:http';
import { createApp } from './app.ts';

export interface ServerOptions {
  port?: number;
  host?: string;
}

/** Create and return a Node.js HTTP server wired up with the app handler. */
export function createServer(options: ServerOptions = {}): Server {
  const { port = 3000, host = '127.0.0.1' } = options;
  const handler = createApp();
  const server = nodeCreateServer(handler);

  server.listen(port, host);
  return server;
}
