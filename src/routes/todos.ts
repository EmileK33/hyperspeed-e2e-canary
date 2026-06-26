import type http from 'node:http';
import type { RouteHandler } from '../server/app.ts';
import { sendJson } from '../server/app.ts';
import { createTodo, listTodos, toggleTodo } from '../store/todos.ts';

/** Route handler for todo CRUD endpoints. */
export function todosRouter(): RouteHandler {
  return async (req: http.IncomingMessage, res: http.ServerResponse, body: unknown): Promise<boolean> => {
    const url = req.url ?? '';
    const method = req.method ?? '';

    // POST /todos — create
    if (method === 'POST' && url === '/todos') {
      const title = (body as Record<string, unknown>)?.title;
      if (typeof title !== 'string' || !title.trim()) {
        sendJson(res, 400, { error: '`title` is required' });
        return true;
      }
      const todo = await createTodo(title.trim());
      sendJson(res, 201, todo);
      return true;
    }

    // GET /todos — list
    if (method === 'GET' && url === '/todos') {
      const todos = await listTodos();
      sendJson(res, 200, todos);
      return true;
    }

    // POST /todos/:id/toggle
    const toggleMatch = url.match(/^\/todos\/([^/]+)\/toggle$/);
    if (method === 'POST' && toggleMatch) {
      const id = toggleMatch[1];
      const todo = await toggleTodo(id);
      if (!todo) {
        sendJson(res, 404, { error: 'Todo not found' });
        return true;
      }
      sendJson(res, 200, todo);
      return true;
    }

    return false;
  };
}
