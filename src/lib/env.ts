// Environment variable helpers — shared scaffold, owned by S0-A.

/**
 * Read a required environment variable. Throws if unset/empty.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Read an optional environment variable, returning the provided default
 * (or undefined) when unset.
 */
export function optionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Read DATABASE_URL (required for any database operation).
 * Throws with a helpful message if absent.
 */
export function databaseUrl(): string {
  return requireEnv('DATABASE_URL');
}
