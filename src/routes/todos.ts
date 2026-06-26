/**
 * /todos CRUD routes.
 * S0-B: stub — S2-A will own this file.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RouterFn } from '../server.ts';
import { createTodo, getTodo, listTodos, toggleTodo } from '../store/todos.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function todosRouter(): RouterFn {
  return async (req, res, next) => {
    const url = req.url ?? '';

    // GET /todos
    if (req.method === 'GET' && url === '/todos') {
      send(res, 200, listTodos());
      return;
    }

    // POST /todos
    if (req.method === 'POST' && url === '/todos') {
      const raw = await readBody(req);
      let parsed: { title?: string };
      try { parsed = JSON.parse(raw); } catch { send(res, 400, { error: 'Invalid JSON' }); return; }
      if (!parsed.title) { send(res, 400, { error: 'title is required' }); return; }
      send(res, 201, createTodo(parsed.title));
      return;
    }

    // GET /todos/:id
    const getMatch = /^\/todos\/([^/]+)$/.exec(url);
    if (req.method === 'GET' && getMatch) {
      const todo = getTodo(getMatch[1]);
      if (!todo) { send(res, 404, { error: 'Not found' }); return; }
      send(res, 200, todo);
      return;
    }

    // PATCH /todos/:id/toggle
    const toggleMatch = /^\/todos\/([^/]+)\/toggle$/.exec(url);
    if (req.method === 'PATCH' && toggleMatch) {
      const todo = toggleTodo(toggleMatch[1]);
      if (!todo) { send(res, 404, { error: 'Not found' }); return; }
      send(res, 200, todo);
      return;
    }

    next();
  };
}
