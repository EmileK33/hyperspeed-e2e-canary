/**
 * Integration smoke tests — phase-safe harness validation.
 *
 * These tests run after every integration wave (including integration-0,
 * before any feature routes exist).  Rules:
 *   - Always-passing assertions run unconditionally.
 *   - Database assertions are skipped when DATABASE_URL is absent.
 *   - No probing of feature endpoints (/todos, /lists, /health, /status) —
 *     that belongs to the terminal boot-and-hit gate.
 */
import { describe, it, expect } from 'vitest';

const hasDb = Boolean(process.env.DATABASE_URL);

describe('integration harness smoke', () => {
  it('test framework is wired up', () => {
    expect(1 + 1).toBe(2);
  });

  it('environment is node', () => {
    expect(typeof process).toBe('object');
    expect(typeof process.version).toBe('string');
  });

  it.skipIf(!hasDb)('postgres fixture db is reachable', async () => {
    const { createPool } = await import('./fixtures.ts');
    const pool = await createPool();
    try {
      const { rows } = await pool.query<{ val: number }>('SELECT 1 AS val');
      expect(rows[0].val).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it.skipIf(!hasDb)('fixture schema tables exist', async () => {
    const { createPool } = await import('./fixtures.ts');
    const pool = await createPool();
    try {
      const { rows } = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM   information_schema.tables
        WHERE  table_schema = 'public'
          AND  table_name   IN ('todos', 'lists')
        ORDER  BY table_name
      `);
      const names = rows.map(r => r.table_name);
      expect(names).toContain('todos');
      expect(names).toContain('lists');
    } finally {
      await pool.end();
    }
  });

  it.skipIf(!hasDb)('todos table has the expected columns', async () => {
    const { createPool } = await import('./fixtures.ts');
    const pool = await createPool();
    try {
      const { rows } = await pool.query<{ column_name: string }>(`
        SELECT column_name
        FROM   information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'todos'
        ORDER  BY ordinal_position
      `);
      const cols = rows.map(r => r.column_name);
      expect(cols).toContain('id');
      expect(cols).toContain('title');
      expect(cols).toContain('done');
    } finally {
      await pool.end();
    }
  });
});
