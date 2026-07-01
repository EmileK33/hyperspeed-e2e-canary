/**
 * Environment variable parsing and validation.
 * All environment access should go through this module.
 */

export interface Env {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: string;
}

/** Read and lightly parse the process environment. */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  return {
    DATABASE_URL: raw['DATABASE_URL'] ?? '',
    PORT: parseInt(raw['PORT'] ?? '3000', 10),
    NODE_ENV: raw['NODE_ENV'] ?? 'development',
  };
}

/**
 * Throw if a required environment variable is absent or empty.
 * Use at server startup to fail fast rather than at query time.
 */
export function requireEnv(key: string, source: NodeJS.ProcessEnv = process.env): string {
  const value = source[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Singleton env snapshot — populated once at module load. */
export const env: Env = parseEnv();
