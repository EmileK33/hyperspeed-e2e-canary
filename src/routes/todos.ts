// Session S2-D — todos route (US-003)
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
      const body = req.body as { title?: string; list_id?: number | null } | undefined;
      if (!body || typeof body.title !== 'string' || !body.title.trim()) {
        sendJson(res, 400, { error: 'title is required' });
        return;
      }
      const todo = await createTodo(body.title.trim(), body.list_id ?? null);
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

/** Named export required by session contracts. */
export function todosRouter(): Route[] {
  return routes;
}
