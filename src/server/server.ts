import * as http from 'node:http';
import type { Store, RouteMount } from '../store/types.ts';

function buildMatcher(path: string): (url: string) => Record<string, string> | null {
  const keys: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_: string, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  const re = new RegExp(`^${pattern}$`);
  return (url: string) => {
    const m = re.exec(url);
    if (!m) return null;
    const params: Record<string, string> = {};
    keys.forEach((k, i) => { params[k] = m[i + 1]; });
    return params;
  };
}

export function createServer(store: Store, mounts: RouteMount[]): http.Server {
  const routes = mounts.map(m => ({ ...m, match: buildMatcher(m.path) }));

  return http.createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    const method = req.method ?? 'GET';

    for (const route of routes) {
      if (route.method !== method) continue;
      const params = route.match(url);
      if (params === null) continue;
      try {
        await route.handler(req, res, params);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}
