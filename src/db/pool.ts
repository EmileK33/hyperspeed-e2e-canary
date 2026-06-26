// Database pool abstraction. Wraps the in-memory store with a pool-like API
// so future sessions can swap in a real DB client without API changes.

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface Pool {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

/** Lightweight in-memory pool used during tests / development. */
class InMemoryPool implements Pool {
  async query<T = Record<string, unknown>>(_sql: string, _params?: unknown[]): Promise<QueryResult<T>> {
    // Real SQL execution is handled by domain functions in contracts.ts.
    // This pool exists as a hook for future DB integration.
    return { rows: [], rowCount: 0 };
  }

  async end(): Promise<void> {
    // No-op for in-memory pool.
  }
}

let _pool: Pool | null = null;

/** Return the singleton pool instance. */
export function getPool(): Pool {
  if (!_pool) {
    _pool = new InMemoryPool();
  }
  return _pool;
}

/** Replace the pool (useful in tests). */
export function setPool(pool: Pool): void {
  _pool = pool;
}
