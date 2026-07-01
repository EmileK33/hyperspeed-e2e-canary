/**
 * Shared domain types and API contracts.
 * Imported by route handlers, store modules, and middleware.
 */

// ── Domain models ────────────────────────────────────────────────

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export interface List {
  id: number;
  name: string;
}

// ── HTTP / Route contracts ───────────────────────────────────────

import type { IncomingMessage, ServerResponse } from 'node:http';

/** A parsed HTTP request with an optional body payload. */
export interface AppRequest extends IncomingMessage {
  params?: Record<string, string>;
  body?: unknown;
}

/** Handler function signature for all routes. */
export type RouteHandler = (
  req: AppRequest,
  res: ServerResponse,
) => void | Promise<void>;

/** A single mounted route. */
export interface Route {
  method: string;   // e.g. "GET", "POST"
  path: string;     // e.g. "/todos", "/todos/:id/toggle"
  handler: RouteHandler;
}

// ── API response shapes ──────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface HealthResponse {
  status: 'ok';
}

export interface StatusResponse {
  version: string;
  uptimeSeconds: number;
  brandColor: string;
}
