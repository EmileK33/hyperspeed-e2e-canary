/**
 * Application factory.
 * Creates a dispatcher that resolves incoming (method, path) pairs
 * to registered Route handlers.
 * S0-A: Shared scaffold / infrastructure
 */

import type { Route, IncomingRequest, ServerResponse } from './types/contracts.ts';
import { getRoutes } from './routes/index.ts';

export interface AppConfig {
  /** Extra routes to mount in addition to the global registry. */
  routes?: Route[];
}

export interface App {
  /** All routes known to this app instance. */
  getRoutes(): Route[];
  /** Mount additional routes at runtime. */
  addRoutes(routes: Route[]): void;
  /**
   * Find the first registered route matching the given method + path.
   * Returns `undefined` if no match is found (→ 404).
   */
  dispatch(method: string, path: string): Route | undefined;
  /**
   * Handle an incoming request, writing the response.
   * Falls through to a generic 404 JSON body if no route matches.
   */
  handle(req: IncomingRequest, res: ServerResponse): Promise<void>;
}

/** Build a JSON 404 response. */
function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Route not found' }));
}

/** Create a new App instance. */
export function createApp(config: AppConfig = {}): App {
  const localRoutes: Route[] = [...(config.routes ?? [])];

  function allRoutes(): Route[] {
    return [...localRoutes, ...getRoutes()];
  }

  return {
    getRoutes(): Route[] {
      return allRoutes();
    },

    addRoutes(routes: Route[]): void {
      localRoutes.push(...routes);
    },

    dispatch(method: string, path: string): Route | undefined {
      return allRoutes().find(
        r =>
          r.method.toUpperCase() === method.toUpperCase() &&
          r.path === path
      );
    },

    async handle(req: IncomingRequest, res: ServerResponse): Promise<void> {
      const method = req.method ?? 'GET';
      const url = req.url ?? '/';
      // Strip query string for matching
      const path = url.split('?')[0];
      const route = this.dispatch(method, path);
      if (!route) {
        notFound(res);
        return;
      }
      await route.handler(req, res);
    },
  };
}
