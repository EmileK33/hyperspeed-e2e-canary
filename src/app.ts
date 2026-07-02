/**
 * Application server factory.
 *
 * `createServer()` builds and returns a node:http `Server` configured with:
 *   - JSON body parsing for every request
 *   - Route dispatch via the registered route table
 *   - A catch-all 404 handler that returns `{ error: "Route not found" }`
 *
 * Route modules call `registerRoutes()` from `src/routes/index.ts` before
 * `createServer()` is invoked; `createServer()` reads the table via
 * `getRoutes()`.
 *
 * This file is pre-seeded on the base branch — do NOT edit it to mount
 * individual routes. Routes self-register; this factory just dispatches.
 */

import { getRoutes } from './routes/index.ts';
import { matchPath, sendJson, parseJsonBody } from './http.ts';
import type { AppRequest, AppResponse } from './types/contracts.ts';

// Minimal structural types for node:http objects — avoids @types/node dependency.
interface NodeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', listener: (chunk: { toString(): string }) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function adaptRequest(req: NodeRequest, body: unknown): AppRequest {
  return {
    method: req.method ?? 'GET',
    url: req.url ?? '/',
    headers: req.headers,
    body,
  };
}

function adaptResponse(res: NodeResponse): AppResponse {
  return {
    get statusCode() { return res.statusCode; },
    set statusCode(v: number) { res.statusCode = v; },
    setHeader(name: string, value: string) { res.setHeader(name, value); },
    end(body?: string) { res.end(body); },
  };
}

async function readBody(req: NodeRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', (err: Error) => reject(err));
  });
}

export async function createServer(): Promise<{ listen(port: number, cb: () => void): void; on(event: string, cb: (err: Error) => void): void }> {
  const httpMod = 'node:http';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const http = await import(/* @vite-ignore */ httpMod) as any;
  return http.createServer(async (req: NodeRequest, res: NodeResponse) => {
    try {
      const rawBody = await readBody(req);
      const parsedBody = parseJsonBody(rawBody);
      const appReq = adaptRequest(req, parsedBody);
      const appRes = adaptResponse(res);

      const url = new URL(appReq.url, 'http://localhost');
      const pathname = url.pathname;
      const method = appReq.method.toUpperCase();

      const routes = getRoutes();
      for (const route of routes) {
        if (route.method.toUpperCase() !== method) continue;
        const params = matchPath(route.path, pathname);
        if (params !== null) {
          await route.handler(appReq, appRes, params);
          return;
        }
      }

      // No matching route found
      sendJson(appRes, 404, { error: 'Route not found' });
    } catch (_err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}
