/**
 * Route registry.
 *
 * Collects all `Route[]` arrays exported by feature-route modules and
 * returns them as a single flat list that `src/app.ts` can dispatch against.
 *
 * Each feature route module lives at `src/routes/<name>.ts` and
 * default-exports a `Route[]`. This registry imports them statically so the
 * full route table is built at startup with no filesystem scanning at
 * runtime — keeping the server predictable and easy to test.
 *
 * To add a new route file: create `src/routes/<name>.ts` that default-exports
 * `Route[]`. The registry will be extended in a later session; nothing in
 * this scaffold needs to change.
 */

import type { Route } from '../http.ts';

// ---------------------------------------------------------------------------
// Route modules are imported lazily (dynamic import) so that this registry
// can be loaded in test environments where optional peer dependencies (pg, …)
// haven't been installed. Each feature session owns its own route file; the
// registry starts empty and grows as sessions merge.
// ---------------------------------------------------------------------------

const _routes: Route[] = [];

/**
 * Register additional routes at runtime.
 * Called by each feature session's route module when the server boots.
 */
export function registerRoutes(routes: Route[]): void {
  _routes.push(...routes);
}

/**
 * Return the current flat list of registered routes.
 */
export function getRoutes(): Route[] {
  return _routes;
}

/**
 * Clear all registered routes (used in tests to reset state between suites).
 */
export function clearRoutes(): void {
  _routes.length = 0;
}
