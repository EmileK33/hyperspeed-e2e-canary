/**
 * Todos route module — US-003 Core todo operations.
 * Implements GET /todos, POST /todos, and POST /todos/:id/toggle.
 * S2-D: todo
 */

import { type Route, sendJson, extractParam } from '../http.js';
import { registerRoutes } from './index.js';
import { createTodo, listTodos, toggleTodo } from '../store/todos.js';

// ---------------------------------------------------------------------------
// Route definitions
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
      const body = req.body as Record<string, unknown> | undefined;
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
      // Extract :id from the request URL directly (params not injected by dispatcher).
      const rawUrl = (req.url ?? '').split('?')[0];
      const idStr = extractParam(rawUrl, '/todos/:id/toggle', 'id');
      const id = parseInt(idStr ?? '', 10);
      if (isNaN(id)) {
        sendJson(res, 400, { error: 'invalid id' });
        return;
      }
      const todo = await toggleTodo(id);
      if (!todo) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      sendJson(res, 200, todo);
    },
  },
];

// Register with the global registry so the app auto-discovers these routes.
registerRoutes(routes);

/**
 * Returns the Route[] for this module.
 * Other sessions may import this to mount the routes in a test server.
 */
export function todosRouter(): Route[] {
  return routes;
}

export default routes;
