/**
 * src/server/app.ts — S1-A: HTTP server bootstrap (US-002)
 *
 * Re-exports `createServer` from the base scaffold (`src/app.ts`) so that
 * downstream consumers can import from this canonical path.
 *
 * US-002 ACs:
 *   AC-1: `createServer()` returns a configured app with JSON parsing enabled.
 *   AC-2: An unknown route returns `404` with a JSON error body.
 */

export { createServer } from '../app.ts';
