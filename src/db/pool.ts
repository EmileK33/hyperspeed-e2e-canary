/**
 * Database pool abstraction.
 *
 * Defines the DbPool / DbClient interface so feature sessions can type-check
 * against it without importing pg directly. The real pg.Pool satisfies this
 * interface at runtime; tests may supply a createNullPool() stub.
 */

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

export interface DbPool extends DbClient {
  end(): Promise<void>;
  connect(): Promise<DbClient & { release(): void }>;
}

// Module-level singleton, set by the server entry point.
let _pool: DbPool | null = null;

/**
 * Register the application-wide pool instance.
 * Called once during server boot after connecting to Postgres.
 */
export function setPool(pool: DbPool): void {
  _pool = pool;
}

/**
 * Retrieve the application-wide pool instance.
 * Throws if setPool() has not been called yet.
 */
export function getPool(): DbPool {
  if (_pool === null) {
    throw new Error(
      'Database pool not initialised — call setPool() before getPool().'
    );
  }
  return _pool;
}

/**
 * Reset the singleton (useful in tests to avoid state leakage).
 */
export function resetPool(): void {
  _pool = null;
}

/**
 * Create a no-op pool suitable for unit tests that do not hit Postgres.
 */
export function createNullPool(): DbPool {
  const noop = async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({
    rows: [],
    rowCount: 0,
  });

  return {
    query: noop,
    end: async (): Promise<void> => {},
    connect: async () => ({
      query: noop,
      release: () => {},
    }),
  };
}
