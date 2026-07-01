/**
 * Environment variable helpers.
 * Centralises all `process.env` access so every other module can import
 * typed, validated values instead of reading raw strings.
 */

/** Throw if a required env var is absent, otherwise return its value. */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Return the env var value, or `fallback` when absent/empty. */
export function getEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value : fallback;
}

/** Validated, typed env for the whole application. */
export interface AppEnv {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
}

export function loadEnv(): AppEnv {
  const DATABASE_URL = requireEnv('DATABASE_URL');
  const portRaw = getEnv('PORT', '3000');
  const PORT = parseInt(portRaw, 10);
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT value: ${portRaw}`);
  }
  const nodeEnvRaw = getEnv('NODE_ENV', 'development');
  if (nodeEnvRaw !== 'development' && nodeEnvRaw !== 'production' && nodeEnvRaw !== 'test') {
    throw new Error(`Invalid NODE_ENV value: ${nodeEnvRaw}`);
  }
  return { DATABASE_URL, PORT, NODE_ENV: nodeEnvRaw };
}
