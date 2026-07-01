/**
 * HTTP server bootstrap — US-002
 *
 * createServer() returns a node:http Server that:
 *   - Parses JSON request bodies (AC-1)
 *   - Dispatches to registered Route handlers (from src/types/contracts.ts)
 *   - Returns 404 JSON for unmatched routes (AC-2)
 *
 * Supports simple path-parameter segments (:name) in route definitions.
 */

import { createServer as httpCreateServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import type { Route, RouteContext, RouteResponse } from '../types/contracts.ts';

// ---------------------------------------------------------------------------
// Path matching
// ---------------------------------------------------------------------------

interface MatchResult {
  params: Record<string, string>;
}

/**
 * Convert a route path pattern like `/todos/:id/toggle` into a regex
 * and a list of named capture groups.
 *
 * Strategy: split by `/`, process each segment individually so that
 * param segments (:name) become capture groups and literal segments
 * are regex-escaped.
 */
function compilePath(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const segments = pattern.split('/').map((segment) => {
    if (segment.startsWith(':')) {
      const name = segment.slice(1);
      paramNames.push(name);
      return '([^/]+)';
    }
    // Escape regex special chars in literal segments
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const regexSource = segments.join('/');
  return { regex: new RegExp(`^${regexSource}$`), paramNames };
}

function matchPath(pattern: string, pathname: string): MatchResult | null {
  const { regex, paramNames } = compilePath(pattern);
  const m = regex.exec(pathname);
  if (!m) return null;
  const params: Record<string, string> = {};
  paramNames.forEach((name, i) => {
    params[name] = m[i + 1] ?? '';
  });
  return { params };
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) return undefined;

  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// createServer
// ---------------------------------------------------------------------------

/**
 * Create a configured HTTP server.
 *
 * @param routes  Route[] to mount. Feature modules pass their exported arrays
 *                here; the server auto-dispatches by method + path.
 */
export function createServer(routes: Route[] = []): Server {
  return httpCreateServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = (req.method ?? 'GET').toUpperCase() as Route['method'];
    const rawUrl = req.url ?? '/';

    // Separate pathname from query string
    const qIndex = rawUrl.indexOf('?');
    const pathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
    const queryString = qIndex === -1 ? '' : rawUrl.slice(qIndex + 1);

    // Parse query params
    const query: Record<string, string> = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        query[key] = value;
      });
    }

    // Match route
    let matched: { route: Route; params: Record<string, string> } | null = null;
    for (const route of routes) {
      if (route.method !== method) continue;
      const result = matchPath(route.path, pathname);
      if (result) {
        matched = { route, params: result.params };
        break;
      }
    }

    if (!matched) {
      sendJson(res, 404, { error: 'Route not found', code: 'NOT_FOUND' });
      return;
    }

    // Parse body
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid request body', code: 'BAD_REQUEST' });
      return;
    }

    const ctx: RouteContext = {
      params: matched.params,
      query,
      body,
    };

    // Invoke handler
    let response: RouteResponse;
    try {
      response = await matched.route.handler(ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      sendJson(res, 500, { error: message, code: 'INTERNAL_ERROR' });
      return;
    }

    sendJson(res, response.status, response.body);
  });
}
