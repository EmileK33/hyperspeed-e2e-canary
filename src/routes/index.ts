/**
 * Route registry.
 *
 * This module scans for route modules under src/routes/ and provides
 * utilities for matching incoming requests to handlers.
 *
 * Route modules must default-export a Route[] array.
 * The server (src/app.ts) uses this registry to dispatch requests.
 */

import type { Route } from '../types/contracts.ts';

// ── Route matching ───────────────────────────────────────────────

export interface MatchResult {
  route: Route;
  params: Record<string, string>;
}

/**
 * Parse a path pattern like "/todos/:id/toggle" into a RegExp
 * and capture the named param keys.
 */
function parsePattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = pattern
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_: string, key: string) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\//g, '\/');

  return { regex: new RegExp(`^${source}$`), keys };
}

/**
 * Match a method + url against a list of routes.
 * Returns the first match (route + extracted params), or null.
 */
export function matchRoute(
  method: string,
  url: string,
  routes: Route[],
): MatchResult | null {
  // Strip query string
  const pathname = url.split('?')[0] ?? url;

  for (const route of routes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) continue;

    const { regex, keys } = parsePattern(route.path);
    const m = regex.exec(pathname);
    if (!m) continue;

    const params: Record<string, string> = {};
    keys.forEach((key, i) => {
      params[key] = m[i + 1] ?? '';
    });

    return { route, params };
  }

  return null;
}

// ── Registry class ───────────────────────────────────────────────

export class RouteRegistry {
  private _routes: Route[] = [];

  /** Register one or more routes. */
  register(...routes: Route[]): this {
    this._routes.push(...routes);
    return this;
  }

  /** All registered routes (read-only view). */
  get routes(): readonly Route[] {
    return this._routes;
  }

  /** Match a request against all registered routes. */
  match(method: string, url: string): MatchResult | null {
    return matchRoute(method, url, this._routes);
  }
}

/** Global route registry — populated by feature route modules at startup. */
export const registry = new RouteRegistry();
