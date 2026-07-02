// Session S1-A — server bootstrap (US-002).
//
// Re-exports `createServer` from the canonical server module (src/app.ts, owned
// by S0-A). This file is the contract export point for sessions that import
// `createServer` from `src/server/app`.
export { createServer } from '../app.js';
