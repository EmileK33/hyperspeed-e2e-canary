import type http from 'node:http';
import type { RouteHandler } from '../server/app.ts';
import { sendJson } from '../server/app.ts';
import { randomUUID } from 'node:crypto';

type List = { id: string; name: string };
const listsStore = new Map<string, List>();

/** Route handler for saved-lists endpoints (US-004). */
export function listsRouter(): RouteHandler {
  return async (req: http.IncomingMessage, res: http.ServerResponse, body: unknown): Promise<boolean> => {
    const url = req.url ?? '';
    const method = req.method ?? '';

    // POST /lists — create
    if (method === 'POST' && url === '/lists') {
      const name = (body as Record<string, unknown>)?.name;
      if (typeof name !== 'string' || !name.trim()) {
        sendJson(res, 400, { error: '`name` is required' });
        return true;
      }
      const list: List = { id: randomUUID(), name: name.trim() };
      listsStore.set(list.id, list);
      sendJson(res, 201, list);
      return true;
    }

    // GET /lists — list all
    if (method === 'GET' && url === '/lists') {
      sendJson(res, 200, [...listsStore.values()]);
      return true;
    }

    return false;
  };
}
