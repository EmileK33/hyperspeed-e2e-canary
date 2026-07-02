// src/server/app.ts — Session S1-A
//
// US-002: HTTP server bootstrap.
// Re-exports createServer from the canonical server module (src/app.ts, owned
// by S0-A) so that consumers can import from this path while the actual
// implementation lives in the single authoritative location.

export { createServer } from '../app.js';
