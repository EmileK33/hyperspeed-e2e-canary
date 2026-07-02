// src/routes/todos.ts — Session S2-D
//
// US-003: Todo CRUD endpoints.
// GET  /todos          → 200 [Todo[]]
// POST /todos          → 201 Todo
// POST /todos/:id/toggle → 200 Todo

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
      const body = req.body as { title?: string } | undefined;
      const title = body?.title;
      if (!title || typeof title !== 'string') {
        sendJson(res, 400, { error: 'title is required' });
        return;
      }
      const todo = await createTodo(title);
      sendJson(res, 201, todo);
    },
  },
  {
    method: 'POST',
    path: '/todos/:id/toggle',
    handler: async (req, res) => {
      const id = parseInt(req.params.id, 10);
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

export default routes;

/** Named export required by the build contract (S2-D exports todosRouter). */
export function todosRouter(): Route[] {
  return routes;
}
