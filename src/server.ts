/**
 * HTTP server entry point.
 *
 * Boots the application:
 *   1. Runs database migrations (schema must exist before routes handle requests)
 *   2. Starts the HTTP listener on `PORT` (default 3000)
 *
 * This file is pre-seeded on the base branch and should not be edited by
 * feature-route sessions — their routes self-register via `registerRoutes()`.
 */

// Declare Node.js globals without requiring @types/node.
declare const process: {
  env: Record<string, string | undefined>;
  exit(code: number): never;
};

import { createServer } from './app.ts';
import { serverPort } from './lib/env.ts';

const port = serverPort();

createServer().then((server) => {
  server.listen(port, () => {
    console.log(`Canary Todos API listening on http://localhost:${port}`);
  });

  server.on('error', (err: Error) => {
    console.error('Server error:', err.message);
    process.exit(1);
  });
}).catch((err: unknown) => {
  console.error('Failed to create server:', err);
  process.exit(1);
});
