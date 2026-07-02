/**
 * Shared domain types for the Canary Todos API.
 * Other sessions import from this path — never re-declare these here.
 */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export interface List {
  id: number;
  name: string;
}

/** Generic JSON-serialisable API response wrapper */
export interface ApiOk<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

/** Minimal HTTP-request shape used by the framework-free server */
export interface AppRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Minimal HTTP-response shape used by the framework-free server */
export interface AppResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}
