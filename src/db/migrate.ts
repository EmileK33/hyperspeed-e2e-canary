// Database migration runner.

import { getPool } from './pool.ts';

export interface MigrationResult {
  applied: number;
  skipped: number;
}

/** Run all pending migrations against the pool. */
export async function migrate(): Promise<MigrationResult> {
  const pool = getPool();
  // In-memory pool — no DDL to run.
  await pool.query('-- migrate placeholder');
  return { applied: 0, skipped: 0 };
}
