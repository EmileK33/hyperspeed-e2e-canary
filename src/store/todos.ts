/**
 * In-memory todo store.
 * S0-B: stub implementation — later sessions (S1-A / S1-B) own this file
 * and will replace these stubs with the full implementation.
 */

import { randomUUID } from 'node:crypto';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

// Module-level store (reset between tests via resetStore())
let store: Map<string, Todo> = new Map();

/** Reset the in-memory store — used by test setup. */
export function resetStore(): void {
  store = new Map();
}

/** Create and persist a new Todo. */
export function createTodo(title: string): Todo {
  const todo: Todo = {
    id: randomUUID(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
  };
  store.set(todo.id, todo);
  return todo;
}

/** Retrieve a single Todo by id, or undefined if not found. */
export function getTodo(id: string): Todo | undefined {
  return store.get(id);
}

/** Return all Todos as an array. */
export function listTodos(): Todo[] {
  return Array.from(store.values());
}

/** Toggle the done flag on a Todo.  Returns the updated Todo or undefined. */
export function toggleTodo(id: string): Todo | undefined {
  const todo = store.get(id);
  if (!todo) return undefined;
  const updated: Todo = { ...todo, done: !todo.done };
  store.set(id, updated);
  return updated;
}
