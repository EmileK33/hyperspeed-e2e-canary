/**
 * Environment-variable helpers.
 * Centralises access so callers get type-safe strings and fail-fast on
 * missing required values rather than silently using `undefined`.
 */

// Declare the Node.js process global without requiring @types/node.
declare const process: { env: Record<string, string | undefined> };

/**
 * Returns the value of an environment variable or throws if it is absent.
 */
export function requireEnv(name: string): string {
  const val: string | undefined =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  if (val === undefined || val === '') {
    throw new Error(`Required environment variable "${name}" is not set.`);
  }
  return val;
}

/**
 * Returns the value of an environment variable, or `fallback` if absent.
 */
export function optionalEnv(name: string, fallback: string): string {
  const val: string | undefined =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return val !== undefined && val !== '' ? val : fallback;
}

/** Convenience — the Postgres connection string. */
export function databaseUrl(): string {
  return requireEnv('DATABASE_URL');
}

/** Convenience — the HTTP port the server should listen on. */
export function serverPort(): number {
  return parseInt(optionalEnv('PORT', '3000'), 10);
}
