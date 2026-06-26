import { randomUUID } from 'node:crypto';

/** Core todo entity. */
export type Todo = {
  id: string;
  title: string;
  done: boolean;
};

// In-memory store (integration tests swap this for Postgres via DATABASE_URL).
const store = new Map<string, Todo>();

/** Create and persist a new todo. */
export async function createTodo(title: string): Promise<Todo> {
  const todo: Todo = { id: randomUUID(), title, done: false };
  store.set(todo.id, todo);
  return todo;
}

/** Retrieve a single todo by id. Returns undefined when not found. */
export async function getTodo(id: string): Promise<Todo | undefined> {
  return store.get(id);
}

/** Return all todos. */
export async function listTodos(): Promise<Todo[]> {
  return [...store.values()];
}

/** Flip the done flag on a todo. Returns undefined when not found. */
export async function toggleTodo(id: string): Promise<Todo | undefined> {
  const todo = store.get(id);
  if (!todo) return undefined;
  const updated: Todo = { ...todo, done: !todo.done };
  store.set(id, updated);
  return updated;
}

/** Reset the store (used in tests). */
export function _resetStore(): void {
  store.clear();
}
