/**
 * Environment variable helpers.
 * S0-A: Shared scaffold / infrastructure
 */

/* Access process.env without requiring @types/node at compile time. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> =
  (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) ?? {};

/**
 * Read a required environment variable.
 * Throws if the variable is absent and no fallback is provided.
 */
export function getEnv(key: string, fallback?: string): string {
  const value = env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** `DATABASE_URL` — Postgres connection string. */
export function getDatabaseUrl(): string {
  return getEnv('DATABASE_URL', '');
}

/** `PORT` — HTTP listen port (default 3000). */
export function getPort(): number {
  return parseInt(getEnv('PORT', '3000'), 10);
}
