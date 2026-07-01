/**
 * Integration harness smoke tests (S0-B).
 *
 * Phase-safety contract:
 *   - All tests that do NOT require Postgres must pass on every wave, even
 *     before feature routes or the pg package are available.
 *   - Postgres-dependent tests are guarded with `it.skipIf(!hasDatabase)` so
 *     they silently skip in environments without DATABASE_URL.
 *
 * This file intentionally avoids importing from src/** because feature modules
 * are authored in later phases and would break compilation here in Phase 0.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { hasDatabase, getDbClient, DB_URL } from './fixtures.ts';
import { runMigrations } from './setup.ts';

// ---------------------------------------------------------------------------
// Schema setup — runs once before Postgres tests; no-op when DB is absent.
// ---------------------------------------------------------------------------
beforeAll(async () => {
  if (hasDatabase) {
    await runMigrations();
  }
});

// ---------------------------------------------------------------------------
// Harness health checks (always run — no external dependencies)
// ---------------------------------------------------------------------------
describe('integration harness', () => {
  it('arithmetic sanity', () => {
    expect(1 + 1).toBe(2);
  });

  it('fixture helpers are importable', () => {
    expect(typeof hasDatabase).toBe('boolean');
    expect(typeof DB_URL).toBe('string');
  });

  it('DATABASE_URL flag reflects env var presence', () => {
    const envSet = Boolean(process.env.DATABASE_URL);
    expect(hasDatabase).toBe(envSet);
  });
});

// ---------------------------------------------------------------------------
// Postgres connectivity (skipped when DATABASE_URL is absent)
// ---------------------------------------------------------------------------
describe('database fixtures', () => {
  it.skipIf(!hasDatabase)('connects to Postgres', async () => {
    const client = await getDbClient();
    try {
      const result = await client.query('SELECT 1 AS val');
      expect(result.rows[0].val).toBe(1);
    } finally {
      await client.end();
    }
  });

  it.skipIf(!hasDatabase)('schema tables exist after migrations', async () => {
    const client = await getDbClient();
    try {
      const result = await client.query(
        `SELECT table_name
         FROM   information_schema.tables
         WHERE  table_schema = 'public'
         ORDER  BY table_name`,
      );
      const tables = result.rows.map((r) => r['table_name'] as string);
      expect(tables).toContain('todos');
      expect(tables).toContain('lists');
    } finally {
      await client.end();
    }
  });

  it.skipIf(!hasDatabase)('todos table has expected columns', async () => {
    const client = await getDbClient();
    try {
      const result = await client.query(
        `SELECT column_name
         FROM   information_schema.columns
         WHERE  table_name = 'todos' AND table_schema = 'public'
         ORDER  BY column_name`,
      );
      const cols = result.rows.map((r) => r['column_name'] as string);
      expect(cols).toContain('id');
      expect(cols).toContain('title');
      expect(cols).toContain('done');
    } finally {
      await client.end();
    }
  });
});
