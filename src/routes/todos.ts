import http from 'node:http';
import { createTodo, listTodos, toggleTodo } from '../store/todos.js';

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: unknown,
): Promise<boolean> {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = req.url ?? '/';

  if (method === 'POST' && url === '/todos') {
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      send(res, 400, { error: 'request body must be a JSON object' });
      return true;
    }
    const { title } = body as Record<string, unknown>;
    if (typeof title !== 'string' || title.trim() === '') {
      send(res, 400, { error: 'title is required and must be a non-empty string' });
      return true;
    }
    const todo = await createTodo(title);
    send(res, 201, todo);
    return true;
  }

  if (method === 'GET' && url === '/todos') {
    const todos = await listTodos();
    send(res, 200, todos);
    return true;
  }

  const toggleMatch = /^\/todos\/([^/]+)\/toggle$/.exec(url);
  if (method === 'POST' && toggleMatch !== null) {
    const id = toggleMatch[1];
    const todo = await toggleTodo(id);
    if (todo == null) {
      send(res, 404, { error: `Todo ${id} not found` });
      return true;
    }
    send(res, 200, todo);
    return true;
  }

  return false;
}
