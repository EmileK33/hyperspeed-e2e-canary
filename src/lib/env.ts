/**
 * Read a required environment variable.
 * Throws a descriptive error if the variable is missing or empty.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Read an optional environment variable, returning a default when absent.
 */
export function getEnv(name: string, defaultValue = ''): string {
  return process.env[name] ?? defaultValue;
}
