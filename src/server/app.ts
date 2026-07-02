/**
 * S1-A — Server bootstrap module.
 *
 * Re-exports `createServer` from the base scaffold (`src/app.ts`) so that
 * other sessions can import the factory from this canonical path:
 *
 *   import { createServer } from '../server/app.ts';
 *
 * US-002 acceptance criteria:
 *   AC-1: createServer() returns an HTTP app with JSON body parsing.
 *   AC-2: An unknown route returns 404 with a JSON error body.
 *
 * Both behaviours are implemented in src/app.ts (seeded by S0-A); this
 * module simply surfaces them under the architecture-mandated path.
 */

export { createServer } from '../app.ts';
