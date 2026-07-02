/**
 * src/routes/todos.ts — S2-D: Todo endpoints (US-003)
 *
 * GET  /todos            → list all todos
 * POST /todos            → create a new todo
 * POST /todos/:id/toggle → toggle done flag
 */

import { type Route, sendJson } from '../http.ts';
import { registerRoutes } from './index.ts';
import { listTodos, createTodo, toggleTodo } from '../store/todos.ts';

const routes: Route[] = [
  {
    method: 'GET',
    path: '/todos',
    handler: async (_req, res, _params) => {
      const todos = await listTodos();
      sendJson(res, 200, todos);
    },
  },
  {
    method: 'POST',
    path: '/todos',
    handler: async (req, res, _params) => {
      const body = req.body as { title?: unknown } | null | undefined;
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
    handler: async (_req, res, params) => {
      const id = parseInt(params.id ?? '', 10);
      if (isNaN(id)) {
        sendJson(res, 400, { error: 'invalid id' });
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

// Self-register so importing this module mounts the routes.
registerRoutes(routes);

/**
 * todosRouter — named export required by downstream sessions.
 * Returns the Route[] for the todos endpoints.
 */
export function todosRouter(): Route[] {
  return routes;
}

export default routes;
