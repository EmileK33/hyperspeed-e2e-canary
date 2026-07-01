/**
 * Shared contracts for the Canary Todos API.
 * All cross-session type imports come from here.
 */

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  listId?: string | null;
  createdAt: string;
}

export interface TodoList {
  id: string;
  name: string;
  createdAt: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RouteContext {
  params: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

export type RouteHandler = (
  ctx: RouteContext
) => Promise<ApiResponse> | ApiResponse;

export interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
