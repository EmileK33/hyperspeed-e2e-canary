import { describe, it, expect } from 'vitest';
import {
  createTodo,
  getTodo,
  listTodos,
  toggleTodo,
  type Todo,
} from '../../src/store/todos.js';

describe('todo store', () => {
  it('createTodo inserts a row with done=false and returns the persisted Todo', async () => {
    const todo = await createTodo('buy milk');
    expect(todo.title).toBe('buy milk');
    expect(todo.done).toBe(false);
    expect(typeof todo.id === 'number' || typeof todo.id === 'string').toBe(true);
  });

  it('getTodo returns the matching Todo when the row exists', async () => {
    const created = await createTodo('get matching todo');
    const found = await getTodo(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe('get matching todo');
    expect(found!.done).toBe(false);
  });

  it('getTodo returns null when no row exists for the id', async () => {
    const result = await getTodo(999999999);
    expect(result).toBeNull();
  });

  it('listTodos includes every todo this test inserted', async () => {
    const a = await createTodo('list test a');
    const b = await createTodo('list test b');
    const todos = await listTodos();
    const ids = todos.map(t => t.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('listTodos returns a well-formed array (never null/undefined)', async () => {
    const todos = await listTodos();
    expect(Array.isArray(todos)).toBe(true);
  });

  it('toggleTodo flips done from false to true and persists', async () => {
    const created = await createTodo('toggle false to true');
    expect(created.done).toBe(false);
    const toggled = await toggleTodo(created.id);
    expect(toggled.done).toBe(true);
    const fetched = await getTodo(created.id);
    expect(fetched!.done).toBe(true);
  });

  it('toggleTodo flips done from true to false and persists', async () => {
    const created = await createTodo('toggle true to false');
    await toggleTodo(created.id);
    const toggled = await toggleTodo(created.id);
    expect(toggled.done).toBe(false);
    const fetched = await getTodo(created.id);
    expect(fetched!.done).toBe(false);
  });

  it('exports a Todo type with the contract shape', async () => {
    const todo = await createTodo('type shape check');
    const typed: Todo = todo;
    expect(typeof typed.title).toBe('string');
    expect(typeof typed.done).toBe('boolean');
    expect(typeof typed.id === 'number' || typeof typed.id === 'string').toBe(true);
  });

  it('exports createTodo, getTodo, listTodos, toggleTodo as functions', () => {
    expect(typeof createTodo).toBe('function');
    expect(typeof getTodo).toBe('function');
    expect(typeof listTodos).toBe('function');
    expect(typeof toggleTodo).toBe('function');
  });
});
