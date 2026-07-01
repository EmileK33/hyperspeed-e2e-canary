/**
 * HTTP helpers — framework-free utilities for building JSON responses.
 * Used by route handlers throughout the application.
 * S1-B: src
 */

import type { IncomingRequest, ServerResponse } from './types/contracts.ts';

// Re-export Route so route modules have a single import point.
export type { Route } from './types/contracts.ts';

/**
 * Write a JSON response with the given status code and body.
 */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Write a 200 OK JSON response.
 */
export function ok(res: ServerResponse, body: unknown): void {
  sendJson(res, 200, body);
}

/**
 * Write a 201 Created JSON response.
 */
export function created(res: ServerResponse, body: unknown): void {
  sendJson(res, 201, body);
}

/**
 * Write a 400 Bad Request JSON error response.
 */
export function badRequest(res: ServerResponse, message = 'Bad request'): void {
  sendJson(res, 400, { error: message });
}

/**
 * Write a 404 Not Found JSON error response.
 */
export function notFound(res: ServerResponse, message = 'Not found'): void {
  sendJson(res, 404, { error: message });
}

/**
 * Write a 500 Internal Server Error JSON error response.
 */
export function internalError(
  res: ServerResponse,
  message = 'Internal server error'
): void {
  sendJson(res, 500, { error: message });
}

/**
 * Extract the already-parsed body from a request, cast to T.
 * Returns undefined if no body was parsed.
 */
export function getBody<T = unknown>(req: IncomingRequest): T | undefined {
  return req.body as T | undefined;
}

/**
 * Extract a path segment value from a URL.
 * e.g. extractParam('/todos/42/toggle', '/todos/:id/toggle', 'id') → '42'
 */
export function extractParam(
  url: string,
  pattern: string,
  paramName: string
): string | undefined {
  const urlParts = url.split('?')[0].split('/');
  const patternParts = pattern.split('/');

  if (urlParts.length !== patternParts.length) return undefined;

  for (let i = 0; i < patternParts.length; i++) {
    const seg = patternParts[i];
    if (seg === `:${paramName}`) {
      return urlParts[i];
    }
    if (seg !== urlParts[i]) {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Check whether a URL matches a route pattern (supports :param segments).
 * e.g. matchesPattern('/todos/42/toggle', '/todos/:id/toggle') → true
 */
export function matchesPattern(url: string, pattern: string): boolean {
  const urlParts = url.split('?')[0].split('/');
  const patternParts = pattern.split('/');

  if (urlParts.length !== patternParts.length) return false;

  return patternParts.every(
    (seg, i) => seg.startsWith(':') || seg === urlParts[i]
  );
}
