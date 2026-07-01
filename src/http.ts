/**
 * HTTP utilities for the framework-free node:http server.
 *
 * Provides JSON body parsing, response helpers, query-string parsing,
 * and URL-pattern matching used by the route dispatcher in src/app.ts.
 *
 * This module has NO side-effects on import and depends only on Node
 * built-ins, so it is safe to import in unit tests without a running
 * server or database.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// JSON body parsing
// ---------------------------------------------------------------------------

/**
 * Read the full request body as a UTF-8 string.
 * Resolves to an empty string if there is no body.
 */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Read and JSON-parse the request body.
 * Returns `null` when the body is empty or cannot be parsed as JSON.
 */
export async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req);
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Send a JSON response with the given status code and body.
 * Sets `Content-Type: application/json` and serialises `body` to JSON.
 */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Query-string parsing
// ---------------------------------------------------------------------------

/**
 * Extract the query-string from a raw request URL and return a plain
 * key→value map.  Multi-value keys are collapsed to the last occurrence.
 * Returns an empty object when the URL has no query string.
 */
export function parseQuery(rawUrl: string | undefined): Record<string, string> {
  if (!rawUrl) return {};
  const questionMark = rawUrl.indexOf('?');
  if (questionMark === -1) return {};
  const qs = rawUrl.slice(questionMark + 1);
  const result: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIdx));
      const val = decodeURIComponent(pair.slice(eqIdx + 1));
      result[key] = val;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// URL pattern matching
// ---------------------------------------------------------------------------

/**
 * Test whether a concrete URL pathname matches a route pattern, and if so
 * return an object of extracted named parameters.
 *
 * Patterns use Express-style colon segments, e.g. `/todos/:id/toggle`.
 * Returns `null` when the pathname does not match.
 *
 * Examples:
 *   matchPattern('/todos/:id', '/todos/42')   → { id: '42' }
 *   matchPattern('/todos/:id', '/todos')      → null
 *   matchPattern('/todos', '/todos')          → {}
 */
export function matchPattern(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const cp = pathParts[i]!;
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(cp);
    } else if (pp !== cp) {
      return null;
    }
  }
  return params;
}

/**
 * Extract the pathname (without query string) from a raw request URL.
 * Falls back to `'/'` when the URL is absent or unparseable.
 */
export function getPathname(rawUrl: string | undefined): string {
  if (!rawUrl) return '/';
  const qIdx = rawUrl.indexOf('?');
  return qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
}
