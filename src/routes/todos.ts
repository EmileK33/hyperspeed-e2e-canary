/**
 * Todos route module — US-003.
 *
 * GET  /todos          → list all todos
 * POST /todos          → create a new todo
 * POST /todos/:id/toggle → toggle done on a todo
 *
 * Default-exports a Route[] auto-discovered by the route registry.
 * Also named-exports `todosRouter` for consumers that reference it directly.
 */

import { type Route } from '../server/app.ts';
import {
  listTodos,
  createTodo,
  toggleTodo,
} from '../store/todos.ts';
import { type ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    path: '/todos',
    handler: async (_req, res) => {
      const todos = await listTodos();
      sendJson(res, 200, todos);
    },
  },
  {
    method: 'POST',
    path: '/todos',
    handler: async (req, res) => {
      const body = req.body as { title?: unknown } | undefined;
      const title = body?.title;
      if (typeof title !== 'string' || title.trim() === '') {
        sendJson(res, 400, { error: 'title is required' });
        return;
      }
      const todo = await createTodo(title.trim());
      sendJson(res, 201, todo);
    },
  },
  {
    method: 'POST',
    path: '/todos/:id/toggle',
    handler: async (req, res) => {
      const rawId = req.params?.id;
      const id = rawId !== undefined ? parseInt(rawId, 10) : NaN;
      if (isNaN(id)) {
        sendJson(res, 400, { error: 'Invalid id' });
        return;
      }
      const todo = await toggleTodo(id);
      if (!todo) {
        sendJson(res, 404, { error: 'Todo not found' });
        return;
      }
      sendJson(res, 200, todo);
    },
  },
];

/**
 * Register todo routes on an app's addRoutes function.
 */
export function todosRouter(addRoutes: (routes: Route[]) => void): void {
  addRoutes(routes);
}

/** Auto-discovery default export (consumed by src/routes/index.ts). */
export default routes;
