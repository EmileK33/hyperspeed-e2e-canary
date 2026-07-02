/**
 * Todo routes — US-003
 *
 * Implements:
 *   GET  /todos            → list all todos
 *   POST /todos            → create a new todo
 *   POST /todos/:id/toggle → toggle a todo's done flag
 *
 * Owned by S2-D.
 */

import { type Route, sendJson } from '../http.js';
import { listTodos, createTodo, toggleTodo } from '../store/todos.js';

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
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'invalid id' });
        return;
      }
      try {
        const todo = await toggleTodo(id);
        sendJson(res, 200, todo);
      } catch {
        sendJson(res, 404, { error: 'Todo not found' });
      }
    },
  },
];

export default routes;

/** Named export required by the session contract. */
export function todosRouter(): Route[] {
  return routes;
}
