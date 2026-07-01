/**
 * Route registry.
 *
 * Feature sessions register their Route[] by calling registerRoutes().
 * src/app.ts reads the registry via getRoutes() when dispatching requests.
 */

import type { Route } from '../types/contracts.ts';

const _registry: Route[] = [];

/**
 * Register one or more routes into the global registry.
 * Typically called at module load time by each src/routes/<name>.ts file.
 */
export function registerRoutes(routes: Route[]): void {
  _registry.push(...routes);
}

/**
 * Return a snapshot of all registered routes.
 */
export function getRoutes(): readonly Route[] {
  return _registry;
}

/**
 * Remove all routes from the registry.
 * Useful in tests to prevent state bleeding between test files.
 */
export function clearRoutes(): void {
  _registry.splice(0, _registry.length);
}
