import http from 'node:http';

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: unknown
) => Promise<boolean>;

/** Parse the request body as JSON; returns undefined on empty bodies. */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
    req.on('end', () => {
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/** Send a JSON response. */
export function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Create an HTTP server with JSON body parsing.
 * Routes are registered as handler functions; the first one that returns
 * `true` wins. Unknown routes receive a 404 JSON response.
 */
export function createServer(handlers: RouteHandler[] = []): http.Server {
  return http.createServer(async (req, res) => {
    let body: unknown;
    try {
      body = await parseBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON in request body' });
      return;
    }

    for (const handler of handlers) {
      if (await handler(req, res, body)) return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });
}
