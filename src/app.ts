/**
 * Application factory.
 *
 * createApp() returns a thin dispatcher that can be used by src/server.ts
 * (which wires it to node:http) and by unit/integration tests (which call
 * handle() directly without opening a port).
 *
 * Route auto-discovery: the registry in src/routes/index.ts is populated
 * by each src/routes/<name>.ts module when it is imported. The caller must
 * import those modules before calling createApp() or before the first
 * handle() call.
 */

import type { Route, RouteContext, ApiResponse } from './types/contracts.ts';
import { getRoutes } from './routes/index.ts';

export interface App {
  /**
   * Dispatch a request to the matching registered route.
   * Returns a resolved ApiResponse (never throws at the app level).
   */
  handle(
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string | string[] | undefined>
  ): Promise<ApiResponse>;

  /** Add a route directly to this app instance (useful in tests). */
  addRoute(route: Route): void;
}

/**
 * Build and return a new App dispatcher.
 */
export function createApp(): App {
  const localRoutes: Route[] = [];

  function findMatch(
    method: string,
    requestPath: string
  ): { route: Route; params: Record<string, string> } | null {
    const allRoutes = [...getRoutes(), ...localRoutes];
    const upperMethod = method.toUpperCase();

    for (const route of allRoutes) {
      if (route.method !== upperMethod) continue;
      const params = matchPath(route.path, requestPath);
      if (params !== null) return { route, params };
    }
    return null;
  }

  return {
    addRoute(route: Route): void {
      localRoutes.push(route);
    },

    async handle(
      method: string,
      path: string,
      body: unknown,
      headers: Record<string, string | string[] | undefined>
    ): Promise<ApiResponse> {
      const [pathname, search = ''] = path.split('?') as [string, string?];
      const query: Record<string, string> = {};
      if (search) {
        for (const pair of search.split('&')) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx === -1) continue;
          const k = decodeURIComponent(pair.slice(0, eqIdx));
          const v = decodeURIComponent(pair.slice(eqIdx + 1));
          query[k] = v;
        }
      }

      const match = findMatch(method, pathname);
      if (!match) {
        return { status: 404, body: { error: 'Route not found' } };
      }

      const ctx: RouteContext = {
        params: match.params,
        body,
        query,
        headers,
      };

      try {
        return await match.route.handler(ctx);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        return { status: 500, body: { error: message } };
      }
    },
  };
}

// ── Path matching ────────────────────────────────────────────────────────────

/**
 * Match a URL pathname against a route pattern (supports :param segments).
 * Returns extracted params on match, null on mismatch.
 */
function matchPath(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean);
  const rp = pathname.split('/').filter(Boolean);

  if (pp.length !== rp.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i]!;
    const val = rp[i]!;
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(val);
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}
