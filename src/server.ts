/**
 * Server entry point.
 *
 * Boots the HTTP server and (when DATABASE_URL is set) wires up the
 * Postgres pool and runs migrations before accepting traffic.
 */

import { env } from './lib/env.ts';
import { createServer } from './app.ts';

const server = createServer();
const { PORT } = env;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on('error', (err: Error) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shut down gracefully.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server shut down gracefully.');
    process.exit(0);
  });
});
