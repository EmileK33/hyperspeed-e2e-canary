/**
 * Server factory (US-002 — HTTP server bootstrap).
 * Wraps the App from S0-A and adds JSON body-parsing.
 * S1-A: server
 */

import { createApp } from '../app.ts';
import type { App, AppConfig } from '../app.ts';
import type { IncomingRequest, ServerResponse, Route } from '../types/contracts.ts';

export interface ServerApp {
  /** The underlying App instance. */
  app: App;
  /** All routes registered on the server. */
  getRoutes(): Route[];
  /** Mount additional routes at runtime. */
  addRoutes(routes: Route[]): void;
  /**
   * Handle an HTTP request with JSON body pre-parsing.
   * An unknown route returns 404 with a JSON error body.
   */
  handle(req: IncomingRequest, res: ServerResponse): Promise<void>;
}

/**
 * Create a configured server app with JSON parsing enabled.
 * Returns a ServerApp whose handle() parses JSON request bodies
 * and delegates routing to the underlying App (404 for unknown routes).
 */
export function createServer(config: AppConfig = {}): ServerApp {
  const app = createApp(config);

  return {
    app,

    getRoutes(): Route[] {
      return app.getRoutes();
    },

    addRoutes(routes: Route[]): void {
      app.addRoutes(routes);
    },

    async handle(req: IncomingRequest, res: ServerResponse): Promise<void> {
      // Ensure JSON body is parsed when the body is a raw string.
      if (typeof req.body === 'string') {
        try {
          (req as { body: unknown }).body = JSON.parse(req.body);
        } catch {
          // Leave body as-is if it isn't valid JSON.
        }
      }

      // Set default JSON content-type for all responses.
      res.setHeader('Content-Type', 'application/json');

      await app.handle(req, res);
    },
  };
}
