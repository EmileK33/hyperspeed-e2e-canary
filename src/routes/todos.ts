/**
 * Todos routes — GET /todos, POST /todos, POST /todos/:id/toggle
 *
 * US-003: CRUD operations on todos.
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
      const body = req.body as { title?: string } | null | undefined;
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
      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        sendJson(res, 400, { error: 'invalid id' });
        return;
      }
      const todo = await toggleTodo(id);
      if (todo === null) {
        sendJson(res, 404, { error: 'Todo not found' });
        return;
      }
      sendJson(res, 200, todo);
    },
  },
];

// Self-register when this module is first imported.
registerRoutes(routes);

/**
 * todosRouter — registers the todos routes with the shared route registry
 * and returns the registered Route array.
 */
export function todosRouter(): Route[] {
  registerRoutes(routes);
  return routes;
}

export default routes;
