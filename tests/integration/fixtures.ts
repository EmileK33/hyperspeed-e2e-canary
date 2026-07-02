/**
 * Integration test fixtures — phase-safe static data and type shapes.
 *
 * This module intentionally has **zero runtime dependencies** on pg or any
 * other package that may not be present in early phases (Phase 0). Feature
 * sessions that need DB-backed helpers should import `setup.ts` instead.
 */

// ---------------------------------------------------------------------------
// Domain types (mirrors src/store shapes; duplicated here so tests are
// self-contained and don't import from src before the store session ships)
// ---------------------------------------------------------------------------

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export interface TodoList {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Static fixture records — safe to use at any phase
// ---------------------------------------------------------------------------

export const fixtureTodos: Todo[] = [
  { id: 1, title: 'Buy groceries', done: false },
  { id: 2, title: 'Write tests', done: true },
  { id: 3, title: 'Ship it', done: false },
];

export const fixtureLists: TodoList[] = [
  { id: 1, name: 'Personal' },
  { id: 2, name: 'Work' },
];

// ---------------------------------------------------------------------------
// Environment helpers (no Node-specific types used directly so the file
// compiles cleanly whether or not @types/node is installed)
// ---------------------------------------------------------------------------

/** Returns the DATABASE_URL from the environment, or an empty string. */
export function getDbUrl(): string {
  // Use bracket notation to avoid "process is not defined" in strict envs.
  return (
    (typeof globalThis !== 'undefined' &&
      // @ts-ignore — process may not be in the type scope without @types/node
      typeof (globalThis as Record<string, unknown>)['process'] !== 'undefined'
      // @ts-ignore
      ? ((globalThis as Record<string, unknown>)['process'] as { env: Record<string, string | undefined> }).env[
          'DATABASE_URL'
        ]
      : undefined) ?? ''
  );
}

/** Returns true when a DATABASE_URL is available in the environment. */
export function hasDatabase(): boolean {
  return getDbUrl().length > 0;
}
