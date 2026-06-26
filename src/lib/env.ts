// Environment variable helpers.

export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

export const PORT = parseInt(getEnv('PORT', '3000'), 10);
export const NODE_ENV = getEnv('NODE_ENV', 'development');
