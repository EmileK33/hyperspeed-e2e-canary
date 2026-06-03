import http from 'node:http';

const MAX_BODY = 1024 * 1024;

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = req.url ?? '/';

    let body: unknown;
    const ct = req.headers['content-type'] ?? '';
    if (ct.includes('application/json')) {
      try {
        body = await readJsonBody(req);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'invalid json';
        send(res, 400, { error: msg });
        return;
      }
    }

    // Route modules are mounted via dynamic import so this file compiles
    // before any route file exists. Each module exports handle(req, res, body)
    // returning true when it handles the request.
    const routeModules = [
      '../routes/todos.js',
      '../routes/lists.js',
      '../routes/health.js',
      '../routes/status.js',
    ];
    for (const mod of routeModules) {
      try {
        type RouteModule = { handle?: (req: http.IncomingMessage, res: http.ServerResponse, body: unknown) => Promise<boolean> | boolean };
        const route = await import(mod) as RouteModule;
        if (typeof route.handle === 'function' && await route.handle(req, res, body)) {
          return;
        }
      } catch {
        // module not yet implemented — continue to next
      }
    }

    send(res, 404, { error: `Cannot ${method} ${url}` });
  });
}
