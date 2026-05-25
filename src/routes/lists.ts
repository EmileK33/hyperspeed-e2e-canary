import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store, RouteMount } from '../store/types.ts';

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

export function listsRoutes(store: Store): RouteMount[] {
  return [
    {
      method: 'POST',
      path: '/lists',
      async handler(req: IncomingMessage, res: ServerResponse) {
        let body: unknown;
        try {
          body = await readBody(req);
        } catch {
          json(res, 400, { error: 'Invalid JSON' });
          return;
        }

        if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>).name !== 'string') {
          json(res, 400, { error: 'name is required' });
          return;
        }

        const trimmed = ((body as Record<string, unknown>).name as string).trim();
        if (trimmed.length === 0) {
          json(res, 400, { error: 'name must not be empty' });
          return;
        }

        const list = store.createList(trimmed);
        json(res, 201, list);
      },
    },
    {
      method: 'GET',
      path: '/lists',
      handler(_req: IncomingMessage, res: ServerResponse) {
        json(res, 200, store.getLists());
      },
    },
  ];
}
