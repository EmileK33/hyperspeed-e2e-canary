/**
 * Shared fixture helpers for the integration test suite.
 *
 * Phase-safe: all exports work without a live database.
 * Later feature sessions extend these helpers once `pg` is available.
 */

/** DATABASE_URL from the environment (empty string when not provisioned). */
export const TEST_DATABASE_URL: string = process.env['DATABASE_URL'] ?? '';

/** True when a Postgres fixture database is available. */
export function hasDatabase(): boolean {
  return Boolean(TEST_DATABASE_URL);
}

/** Lightweight context bag passed into integration tests. */
export interface TestContext {
  /** Connection string for the fixture database (may be empty). */
  databaseUrl: string;
  /** Whether a real database is available in this environment. */
  hasDb: boolean;
}

/** Build a TestContext from the current environment. */
export function getTestContext(): TestContext {
  return {
    databaseUrl: TEST_DATABASE_URL,
    hasDb: hasDatabase(),
  };
}

/**
 * A no-op seed / cleanup pair so tests can call
 *   const { seed, cleanup } = makeFixture();
 * without needing a live DB in Phase 0.
 * Feature sessions replace the body once `pg` is wired up.
 */
export interface FixtureHandle {
  seed(): Promise<void>;
  cleanup(): Promise<void>;
}

export function makeFixture(): FixtureHandle {
  return {
    async seed() {
      // Phase 1+ sessions wire real seeding against `pg` here.
    },
    async cleanup() {
      // Phase 1+ sessions wire real cleanup here.
    },
  };
}
