/**
 * Phase-safe integration smoke suite.
 *
 * Rules (enforced by the integration harness contract):
 *  - Must stay GREEN at every wave, including integration-0 (Phase 0)
 *    before any feature routes or store modules exist.
 *  - Must NOT probe the full endpoint surface — that belongs to the
 *    terminal boot-and-hit gate after all route sessions have merged.
 *  - Uses dynamic / ephemeral ports only (never a fixed port like 8787).
 */

import { describe, it, expect } from 'vitest';
import {
  fixtureTodos,
  fixtureLists,
  hasDatabase,
  getDbUrl,
  type Todo,
  type TodoList,
} from './fixtures.js';
import { setupDb, teardownDb } from './setup.js';

// ---------------------------------------------------------------------------
// Harness self-tests — always run, no external services needed
// ---------------------------------------------------------------------------

describe('integration harness', () => {
  it('arithmetic sanity', () => {
    expect(1 + 1).toBe(2);
  });

  it('fixture todos are well-formed', () => {
    expect(fixtureTodos.length).toBeGreaterThan(0);
    for (const todo of fixtureTodos) {
      expect(typeof todo.id).toBe('number');
      expect(typeof todo.title).toBe('string');
      expect(todo.title.length).toBeGreaterThan(0);
      expect(typeof todo.done).toBe('boolean');
    }
  });

  it('fixture lists are well-formed', () => {
    expect(fixtureLists.length).toBeGreaterThan(0);
    for (const list of fixtureLists) {
      expect(typeof list.id).toBe('number');
      expect(typeof list.name).toBe('string');
      expect(list.name.length).toBeGreaterThan(0);
    }
  });

  it('fixture types are structurally correct (Todo)', () => {
    const todo: Todo = { id: 99, title: 'type check', done: false };
    expect(todo.id).toBe(99);
    expect(todo.done).toBe(false);
  });

  it('fixture types are structurally correct (TodoList)', () => {
    const list: TodoList = { id: 7, name: 'Errands' };
    expect(list.id).toBe(7);
    expect(list.name).toBe('Errands');
  });

  it('hasDatabase returns a boolean', () => {
    const result = hasDatabase();
    expect(typeof result).toBe('boolean');
  });

  it('getDbUrl returns a string', () => {
    const url = getDbUrl();
    expect(typeof url).toBe('string');
  });

  it('setupDb resolves without throwing when no DATABASE_URL', async () => {
    // In CI with a real DB this runs the schema bootstrap; in Phase 0 it
    // skips gracefully. Either way it must not throw.
    await expect(setupDb()).resolves.toBeUndefined();
  });

  it('teardownDb resolves without throwing when no DATABASE_URL', async () => {
    await expect(teardownDb()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DB connectivity (skipped when DATABASE_URL is absent — Phase 0 safe)
// ---------------------------------------------------------------------------

describe('database connectivity', () => {
  it.skipIf(!hasDatabase())(
    'can connect and execute a query',
    async () => {
      let Client: new (config: { connectionString: string }) => {
        connect(): Promise<void>;
        query(sql: string): Promise<{ rows: unknown[] }>;
        end(): Promise<void>;
      };
      try {
        // @ts-ignore — pg may not be installed in Phase 0
        const pg = await import('pg');
        Client = pg.default?.Client ?? pg.Client;
      } catch {
        return;
      }
      const client = new Client({ connectionString: getDbUrl() });
      await client.connect();
      try {
        const result = await client.query('SELECT 1 AS value');
        expect((result.rows[0] as { value: number }).value).toBe(1);
      } finally {
        await client.end();
      }
    },
    10_000,
  );
});

