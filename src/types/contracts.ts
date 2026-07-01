/**
 * Shared type contracts used across routes, store, and middleware.
 */

/** Core todo entity. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
  created_at?: string;
}

/** Core list entity. */
export interface List {
  id: number;
  name: string;
  created_at?: string;
}

/** Standard JSON error response body. */
export interface ApiError {
  error: string;
}

/** Standard JSON success response envelope. */
export interface ApiOk<T = unknown> {
  data: T;
}

/** Pagination parameters. */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/** Authenticated request context attached by auth middleware. */
export interface AuthContext {
  userId?: string;
  role?: string;
}
