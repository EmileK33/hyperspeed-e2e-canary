/**
 * Route registry.
 * Feature sessions push their Route[] into this registry;
 * src/app.ts reads it to build the dispatcher.
 * S0-A: Shared scaffold / infrastructure
 */

import type { Route } from '../types/contracts.ts';

const _registry: Route[] = [];

/**
 * Register one or more routes.
 * Called by feature-route modules at module load time.
 */
export function registerRoutes(routes: Route[]): void {
  _registry.push(...routes);
}

/** Return a snapshot of all registered routes. */
export function getRoutes(): Route[] {
  return [..._registry];
}

/**
 * Clear all registered routes.
 * Useful for test isolation.
 */
export function clearRoutes(): void {
  _registry.length = 0;
}
