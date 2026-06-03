import type http from 'node:http';
import { register, json } from '../server/app.ts';

register((req: http.IncomingMessage, res: http.ServerResponse): boolean => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { status: 'ok' });
    return true;
  }
  return false;
});
