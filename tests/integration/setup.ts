/**
 * Integration-suite global setup / teardown helpers.
 *
 * This module is imported for its side-effects by test files that need
 * per-suite lifecycle hooks beyond the server-per-describe pattern in
 * fixtures.ts.  It re-exports the fixture primitives so test files can
 * import everything they need from a single path:
 *
 *   import { startServer, stopServer, request } from './setup.js';
 *
 * Currently thin by design — it will grow as the suite grows.
 */

export { startServer, stopServer, request } from './fixtures.js';
export type { ServerHandle, TestResponse } from './fixtures.js';
