/**
 * /lists — alias / grouped view of todos.
 * S0-B: stub — S2-B will own this file.
 */

import type { RouterFn } from '../server.ts';
import { listTodos } from '../store/todos.ts';

function send(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function listsRouter(): RouterFn {
  return (req, res, next) => {
    if (req.method === 'GET' && req.url === '/lists') {
      // Returns todos grouped by done status
      const all = listTodos();
      send(res, 200, {
        pending: all.filter((t) => !t.done),
        done: all.filter((t) => t.done),
      });
      return;
    }
    next();
  };
}
