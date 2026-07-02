/**
 * Integration test suite global setup.
 *
 * This module is imported by vitest as a setup file for the integration
 * project. At phase-0 it is intentionally minimal — it just validates that
 * the Node runtime is adequate. Feature waves may extend it with database
 * seeding, migration runs, etc.
 */

// ---------------------------------------------------------------------------
// Runtime guard
// ---------------------------------------------------------------------------

const REQUIRED_MAJOR = 18;
const [major] = process.versions.node.split('.').map(Number);

if (major < REQUIRED_MAJOR) {
  throw new Error(
    `Integration tests require Node.js >= ${REQUIRED_MAJOR} (found ${process.version}). ` +
      'Built-in fetch and other APIs are not available on older runtimes.',
  );
}

// ---------------------------------------------------------------------------
// Environment defaults
// ---------------------------------------------------------------------------

// Ensure tests never accidentally talk to a production service.
process.env['NODE_ENV'] ??= 'test';

export {};
