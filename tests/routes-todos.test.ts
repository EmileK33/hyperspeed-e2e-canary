import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { createStore } from '../src/store/store.ts';
import { createServer } from '../src/server/server.ts';
import { todosRoutes } from '../src/routes/todos.ts';
import type { Store } from '../src/store/types.ts';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: addr.port,
      path,
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string>,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });

    req.on('error', reject);

    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('todos routes', () => {
  let store: Store;
  let server: http.Server;

  beforeEach(() => {
    store = createStore();
    server = createServer(todosRoutes(store));
    return new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(() => {
    return new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it('todosRoutes returns RouteMount array with correct methods and paths', () => {
    const routes = todosRoutes(store);
    expect(Array.isArray(routes)).toBe(true);
    expect(routes).toHaveLength(4);

    const methods = routes.map((r) => r.method);
    expect(methods).toContain('POST');
    expect(methods).toContain('GET');
    expect(methods).toContain('PATCH');
    expect(methods).toContain('DELETE');

    const paths = routes.map((r) => r.path);
    expect(paths.filter((p) => p === '/lists/:id/todos')).toHaveLength(2);
    expect(paths.filter((p) => p === '/todos/:id')).toHaveLength(2);
  });

  describe('POST /lists/:id/todos', () => {
    it('POST /lists/:id/todos returns 201 with todo body when list exists', async () => {
      const list = store.createList('Work');
      const res = await makeRequest(server, 'POST', `/lists/${list.id}/todos`, { text: 'Buy milk' });
      expect(res.status).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        listId: list.id,
        text: 'Buy milk',
        done: false,
      });
      expect(typeof body.id).toBe('string');
    });

    it('POST /lists/:id/todos returns 404 when listId is unknown', async () => {
      const res = await makeRequest(server, 'POST', '/lists/nonexistent-id/todos', { text: 'Buy milk' });
      expect(res.status).toBe(404);
    });

    it('POST /lists/:id/todos sets Content-Type application/json', async () => {
      const list = store.createList('Work');
      const res = await makeRequest(server, 'POST', `/lists/${list.id}/todos`, { text: 'Task' });
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('GET /lists/:id/todos', () => {
    it('GET /lists/:id/todos returns 200 with array of todos for that list', async () => {
      const list = store.createList('Groceries');
      store.createTodo(list.id, 'Milk');
      store.createTodo(list.id, 'Eggs');
      const res = await makeRequest(server, 'GET', `/lists/${list.id}/todos`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ listId: list.id, text: 'Milk' });
      expect(body[1]).toMatchObject({ listId: list.id, text: 'Eggs' });
    });

    it('GET /lists/:id/todos returns 404 when listId is unknown', async () => {
      const res = await makeRequest(server, 'GET', '/lists/nonexistent-id/todos');
      expect(res.status).toBe(404);
    });

    it('GET /lists/:id/todos returns 200 with empty array when list has no todos', async () => {
      const list = store.createList('Empty');
      const res = await makeRequest(server, 'GET', `/lists/${list.id}/todos`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual([]);
    });

    it('GET /lists/:id/todos sets Content-Type application/json', async () => {
      const list = store.createList('Work');
      const res = await makeRequest(server, 'GET', `/lists/${list.id}/todos`);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('GET /lists/:id/todos returns 404 for non-existent list not empty array', async () => {
      const res = await makeRequest(server, 'GET', '/lists/does-not-exist/todos');
      expect(res.status).toBe(404);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(false);
    });
  });

  describe('PATCH /todos/:id', () => {
    it('PATCH /todos/:id returns 200 and toggles done from false to true', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      expect(todo.done).toBe(false);
      const res = await makeRequest(server, 'PATCH', `/todos/${todo.id}`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.done).toBe(true);
      expect(body.id).toBe(todo.id);
    });

    it('PATCH /todos/:id toggles done from true to false', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      store.toggleTodo(todo.id);
      const res = await makeRequest(server, 'PATCH', `/todos/${todo.id}`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.done).toBe(false);
    });

    it('PATCH /todos/:id returns 404 when id is unknown', async () => {
      const res = await makeRequest(server, 'PATCH', '/todos/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('PATCH /todos/:id toggled twice returns todo to original done value', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      await makeRequest(server, 'PATCH', `/todos/${todo.id}`);
      const res = await makeRequest(server, 'PATCH', `/todos/${todo.id}`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.done).toBe(false);
    });

    it('PATCH /todos/:id sets Content-Type application/json', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      const res = await makeRequest(server, 'PATCH', `/todos/${todo.id}`);
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('DELETE /todos/:id', () => {
    it('DELETE /todos/:id returns 204 with empty body', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      const res = await makeRequest(server, 'DELETE', `/todos/${todo.id}`);
      expect(res.status).toBe(204);
      expect(res.body).toBe('');
    });

    it('DELETE /todos/:id returns 404 when id is unknown', async () => {
      const res = await makeRequest(server, 'DELETE', '/todos/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('DELETE /todos/:id removes todo from subsequent GET /lists/:id/todos', async () => {
      const list = store.createList('Work');
      const todo = store.createTodo(list.id, 'Task');
      await makeRequest(server, 'DELETE', `/todos/${todo.id}`);
      const res = await makeRequest(server, 'GET', `/lists/${list.id}/todos`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.find((t: { id: string }) => t.id === todo.id)).toBeUndefined();
    });
  });
});
