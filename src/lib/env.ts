// Shared environment-variable helpers — owned by S0-A (Phase 0).
// Provides typed, fail-fast access to process.env so every module
// reads config through one consistent API rather than scattering raw
// `process.env.X` accesses (and silent undefineds) throughout the codebase.

/**
 * Read a required environment variable.
 * Throws a clear error at startup time if the variable is absent, preventing
 * hard-to-diagnose "undefined" bugs at first use.
 */
export function getEnv(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined && val !== '') return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

/**
 * Read an optional environment variable.
 * Returns undefined (not '') when the variable is unset.
 */
export function getEnvOptional(key: string): string | undefined {
  const val = process.env[key];
  return val === '' ? undefined : val;
}

/**
 * Read an integer environment variable with an optional default.
 * Throws if the value is present but not a valid integer.
 */
export function getEnvInt(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required integer environment variable: ${key}`);
  }
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable ${key} must be an integer (got: ${JSON.stringify(raw)})`);
  }
  return n;
}
