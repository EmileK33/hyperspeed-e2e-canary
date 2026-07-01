/**
 * Environment variable helpers.
 * Provides typed access to process.env with optional fallbacks.
 */

/** Read a required env var; throw if missing and no fallback given. */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Read an optional env var; return undefined if absent. */
export function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

/** Parse DATABASE_URL from environment. */
export function getDatabaseUrl(): string {
  return getEnv('DATABASE_URL', 'postgres://localhost/todos');
}

/** Parse PORT from environment (defaults to 3000). */
export function getPort(): number {
  return parseInt(getEnv('PORT', '3000'), 10);
}
