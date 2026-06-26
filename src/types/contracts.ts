// Core domain types and in-memory CRUD operations for todos.

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── In-memory store (no external DB required for this scaffold) ──────────────

const store = new Map<string, Todo>();

let _idCounter = 1;
function generateId(): string {
  return String(_idCounter++);
}

/** Create a new todo and persist it to the in-memory store. */
export function createTodo(title: string): Todo {
  const now = new Date().toISOString();
  const todo: Todo = {
    id: generateId(),
    title,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
  store.set(todo.id, todo);
  return todo;
}

/** Retrieve a single todo by id, or undefined if not found. */
export function getTodo(id: string): Todo | undefined {
  return store.get(id);
}

/** Return all todos as an array. */
export function listTodos(): Todo[] {
  return Array.from(store.values());
}

/** Toggle the completed flag on a todo. Returns undefined if not found. */
export function toggleTodo(id: string): Todo | undefined {
  const todo = store.get(id);
  if (!todo) return undefined;
  const updated: Todo = {
    ...todo,
    completed: !todo.completed,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

/** Clear the store (used in tests). */
export function _resetStore(): void {
  store.clear();
  _idCounter = 1;
}
