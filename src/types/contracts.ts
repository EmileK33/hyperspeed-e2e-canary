/**
 * Core domain types shared across all sessions.
 * S0-A: Shared scaffold / infrastructure
 */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  created_at?: string;
}

export interface TodoList {
  id: number;
  name: string;
  created_at?: string;
}

/** Minimal HTTP request shape (framework-free). */
export interface IncomingRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Minimal HTTP response shape (framework-free). */
export interface ServerResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(data?: string): void;
}

/** A single mounted route. */
export interface Route {
  method: string;
  path: string;
  handler: (req: IncomingRequest, res: ServerResponse) => void | Promise<void>;
}

/** Minimal DB client interface (decoupled from pg). */
export interface DbClient {
  query<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}
