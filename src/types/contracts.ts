/**
 * Shared domain contracts — types used across route handlers, store modules,
 * and middleware. Single source of truth so every session imports from here
 * rather than re-declaring conflicting shapes.
 */

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  list_id: number | null;
  created_at: string;
}

export interface List {
  id: number;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// HTTP / route contracts
// ---------------------------------------------------------------------------

/** A route handler receives a parsed request context and returns a response. */
export interface RouteContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface RouteResponse {
  status: number;
  body: unknown;
}

export type RouteHandler = (ctx: RouteContext) => RouteResponse | Promise<RouteResponse>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: RouteHandler;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Decoded, verified JWT payload attached to authenticated requests. */
export interface AuthPayload {
  sub: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// API shapes (request / response bodies)
// ---------------------------------------------------------------------------

export interface CreateTodoBody {
  title: string;
  list_id?: number | null;
}

export interface CreateListBody {
  name: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
