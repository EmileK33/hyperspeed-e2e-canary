import http from 'node:http';

const BRAND_COLOR = '#3a86ff';
const VERSION = process.env.npm_package_version ?? '0.1.0';

export async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = req.url ?? '/';

  if (url !== '/status') return false;
  if (method !== 'GET') return false;

  const body = JSON.stringify({
    version: VERSION,
    uptimeSeconds: process.uptime(),
    brandColor: BRAND_COLOR,
  });

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
  return true;
}
