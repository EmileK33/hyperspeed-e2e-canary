import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse) => boolean;

const _registry: RouteHandler[] = [];

export function register(handler: RouteHandler): void {
  _registry.push(handler);
}

export function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    for (const handle of _registry) {
      if (handle(req, res)) return;
    }
    json(res, 404, { error: 'Not Found' });
  });
}

// Discover and load all route modules so they self-register before createServer() is called.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(__dirname, '..', 'routes');
if (fs.existsSync(routesDir)) {
  const files = fs.readdirSync(routesDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();
  await Promise.all(
    files.map((f) => {
      const rel = path.relative(__dirname, path.join(routesDir, f)).replace(/\\/g, '/');
      return import(rel.startsWith('.') ? rel : `./${rel}`);
    })
  );
}
