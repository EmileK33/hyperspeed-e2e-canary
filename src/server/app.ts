// S1-A — server: re-exports createServer from the canonical src/app.ts (S0-A).
// US-002: HTTP server bootstrap — createServer() returns a configured node:http
// server with JSON body parsing and 404-on-unknown-route behaviour, ready for
// feature route modules to be auto-discovered and mounted.
export { createServer } from '../app.js';
