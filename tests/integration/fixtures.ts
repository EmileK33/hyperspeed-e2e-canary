/**
 * Shared test fixtures for the integration suite.
 *
 * These are pure data objects — no I/O.  Feature sessions import them so
 * every wave uses the same canonical shapes without duplicating literals.
 */

// ---------------------------------------------------------------------------
// Todo fixtures
// ---------------------------------------------------------------------------

export interface TodoFixture {
  title: string;
  done: boolean;
}

/** Seed todos covering done/undone states. */
export const todoFixtures: readonly TodoFixture[] = [
  { title: 'Buy milk',      done: false },
  { title: 'Write tests',   done: false },
  { title: 'Ship it',       done: true  },
] as const;

/** A minimal todo used for single-item creation tests. */
export const singleTodo: TodoFixture = { title: 'Fixture todo', done: false };

// ---------------------------------------------------------------------------
// List fixtures
// ---------------------------------------------------------------------------

export interface ListFixture {
  name: string;
}

/** Seed lists. */
export const listFixtures: readonly ListFixture[] = [
  { name: 'Shopping' },
  { name: 'Work'     },
] as const;

/** A minimal list used for single-item creation tests. */
export const singleList: ListFixture = { name: 'Fixture list' };

// ---------------------------------------------------------------------------
// HTTP helpers (type-only, no I/O)
// ---------------------------------------------------------------------------

/** Convenience: build a JSON request body string from any fixture object. */
export function toJsonBody(obj: unknown): string {
  return JSON.stringify(obj);
}
