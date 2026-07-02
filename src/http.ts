/**
 * Minimal framework-free HTTP helpers for the Canary Todos API.
 *
 * Route handlers receive plain node:http objects; this module defines the
 * shared `Route` contract and JSON send/parse utilities so every route
 * module stays consistent without pulling in a third-party framework.
 */

import type { AppRequest, AppResponse } from './types/contracts.ts';

/**
 * A single HTTP route entry.
 * Owned route files (src/routes/<name>.ts) default-export `Route[]`.
 */
export interface Route {
  /** HTTP verb, upper-cased (e.g. "GET", "POST"). */
  method: string;
  /**
   * Path pattern. Segments prefixed with `:` are captured as named params.
   * Example: "/todos/:id/toggle"
   */
  path: string;
  /** Async handler. Receives parsed request + response + captured params. */
  handler: (
    req: AppRequest,
    res: AppResponse,
    params: Record<string, string>,
  ) => Promise<void>;
}

/**
 * Serialise `body` as JSON and write it to the response with the correct
 * Content-Type header. Caller supplies the HTTP status code.
 */
export function sendJson(res: AppResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
}

/**
 * Match a URL pathname against a route path pattern.
 * Returns the captured named parameters on a match, or `null` on no match.
 *
 * @example
 *   matchPath('/todos/:id/toggle', '/todos/42/toggle')
 *   // → { id: '42' }
 */
export function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const seg = patternParts[i];
    const val = pathParts[i];
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(val);
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}

/**
 * Attempt to decode a JSON body from a raw string.
 * Returns `null` if the string is empty or not valid JSON.
 */
export function parseJsonBody(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}
