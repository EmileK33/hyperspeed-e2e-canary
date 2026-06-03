import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: unknown
): Promise<boolean> {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = req.url ?? '/';

  if (url !== '/lists') {
    return false;
  }

  if (method === 'POST') {
    if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
      send(res, 400, { error: 'request body must be a JSON object with a name field' });
      return true;
    }
    const b = body as Record<string, unknown>;
    if (typeof b['name'] !== 'string' || b['name'].length === 0) {
      send(res, 400, { error: 'name must be a non-empty string' });
      return true;
    }
    const name = b['name'];
    const { rows } = await getPool().query<{ id: number; name: string }>(
      'INSERT INTO lists (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    send(res, 201, rows[0]);
    return true;
  }

  if (method === 'GET') {
    const { rows } = await getPool().query<{ id: number; name: string }>(
      'SELECT id, name FROM lists ORDER BY id'
    );
    send(res, 200, rows);
    return true;
  }

  return false;
}
