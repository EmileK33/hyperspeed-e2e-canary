import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store, RouteMount } from '../store/types.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

export function todosRoutes(store: Store): RouteMount[] {
  return [
    {
      method: 'POST',
      path: '/lists/:id/todos',
      async handler(req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
        const list = store.getLists().find((l) => l.id === params.id);
        if (!list) {
          json(res, 404, { error: 'List not found' });
          return;
        }
        const raw = await readBody(req);
        const { text } = JSON.parse(raw) as { text: string };
        const todo = store.createTodo(list.id, text);
        json(res, 201, todo);
      },
    },
    {
      method: 'GET',
      path: '/lists/:id/todos',
      handler(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
        const list = store.getLists().find((l) => l.id === params.id);
        if (!list) {
          json(res, 404, { error: 'List not found' });
          return;
        }
        json(res, 200, store.getTodosByList(params.id));
      },
    },
    {
      method: 'PATCH',
      path: '/todos/:id',
      handler(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
        const todo = store.toggleTodo(params.id);
        if (!todo) {
          json(res, 404, { error: 'Todo not found' });
          return;
        }
        json(res, 200, todo);
      },
    },
    {
      method: 'DELETE',
      path: '/todos/:id',
      handler(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
        const deleted = store.deleteTodo(params.id);
        if (!deleted) {
          json(res, 404, { error: 'Todo not found' });
          return;
        }
        res.writeHead(204);
        res.end();
      },
    },
  ];
}
