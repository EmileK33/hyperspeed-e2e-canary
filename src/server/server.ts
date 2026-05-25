import * as http from 'node:http';
import type { Store, RouteMount } from '../store/types.ts';

function matchPath(template: string, actual: string): Record<string, string> | null {
  const templateParts = template.split('/');
  const actualParts = actual.split('/');
  if (templateParts.length !== actualParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < templateParts.length; i++) {
    const t = templateParts[i];
    const a = actualParts[i];
    if (t.startsWith(':')) {
      params[t.slice(1)] = a;
    } else if (t !== a) {
      return null;
    }
  }
  return params;
}

export function createServer(store: Store, mounts: RouteMount[]): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];
    const method = (req.method ?? 'GET').toUpperCase();

    for (const mount of mounts) {
      if (mount.method.toUpperCase() !== method) continue;
      const params = matchPath(mount.path, pathname);
      if (params === null) continue;

      try {
        await mount.handler(req, res, params);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal' }));
        } else {
          res.socket?.destroy();
        }
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}
