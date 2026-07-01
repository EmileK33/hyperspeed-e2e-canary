/**
 * Environment variable helpers.
 * Provides typed access to process.env with defaults and validation.
 */

// process is available in Node.js / vitest environments
declare const process: { env: Record<string, string | undefined> };

/**
 * Read a required string environment variable.
 * Throws if the variable is absent and no fallback is provided.
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Read an optional environment variable, returning undefined when absent.
 */
export function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

/**
 * Read an integer environment variable.
 */
export function getEnvInt(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(
      `Environment variable ${key} must be an integer, got: "${raw}"`
    );
  }
  return value;
}

/** Server listen port (default 3000). */
export const PORT = getEnvInt('PORT', 3000);

/** Postgres connection string. Empty string signals "not yet configured". */
export const DATABASE_URL = getEnvOptional('DATABASE_URL') ?? '';

/** JWT signing secret (dev default provided). */
export const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret-change-in-prod');

/** Runtime environment label. */
export const NODE_ENV = getEnv('NODE_ENV', 'development');
