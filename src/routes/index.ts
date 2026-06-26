// Route registry — exports all routers used by the application.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createTodo, getTodo, listTodos, toggleTodo } from '../types/contracts.ts';

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface Router {
  prefix: string;
  handle: RouteHandler;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── Health router ──────────────────────────────────────────────────────────

export function healthRouter(): Router {
  return {
    prefix: '/health',
    handle: (_req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  };
}

// ── Status router ──────────────────────────────────────────────────────────

export function statusRouter(): Router {
  return {
    prefix: '/status',
    handle: (_req, res) => {
      sendJson(res, 200, {
        status: 'ok',
        brand: '#3a86ff',
        timestamp: new Date().toISOString(),
      });
    },
  };
}

// ── Todos router ───────────────────────────────────────────────────────────

export function todosRouter(): Router {
  return {
    prefix: '/todos',
    handle: async (req, res) => {
      const url = req.url ?? '/todos';
      const method = req.method ?? 'GET';

      // POST /todos — create
      if (method === 'POST' && (url === '/todos' || url === '/todos/')) {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as { title?: string };
          if (!body.title) {
            sendJson(res, 400, { error: 'title is required' });
            return;
          }
          const todo = createTodo(body.title);
          sendJson(res, 201, todo);
        } catch {
          sendJson(res, 400, { error: 'invalid JSON' });
        }
        return;
      }

      // GET /todos — list
      if (method === 'GET' && (url === '/todos' || url === '/todos/')) {
        sendJson(res, 200, listTodos());
        return;
      }

      // GET /todos/:id
      const getMatch = url.match(/^\/todos\/([^/]+)$/);
      if (method === 'GET' && getMatch) {
        const todo = getTodo(getMatch[1]);
        if (!todo) { sendJson(res, 404, { error: 'not found' }); return; }
        sendJson(res, 200, todo);
        return;
      }

      // PATCH /todos/:id/toggle
      const toggleMatch = url.match(/^\/todos\/([^/]+)\/toggle$/);
      if (method === 'PATCH' && toggleMatch) {
        const todo = toggleTodo(toggleMatch[1]);
        if (!todo) { sendJson(res, 404, { error: 'not found' }); return; }
        sendJson(res, 200, todo);
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    },
  };
}

// ── Lists router ───────────────────────────────────────────────────────────

export function listsRouter(): Router {
  return {
    prefix: '/lists',
    handle: (_req, res) => {
      sendJson(res, 200, { lists: [] });
    },
  };
}
