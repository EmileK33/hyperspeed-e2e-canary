export interface List {
  id: string;
  name: string;
}

export interface Todo {
  id: string;
  listId: string;
  text: string;
  done: boolean;
}

export interface StoreSnapshot {
  lists: List[];
  todos: Todo[];
}

// [CRITICAL BOUNDARY] — Store interface: boundary between S1-A (store impl)
// and every downstream session (S1-B, S2-A, S2-B, S3-B).
export interface Store {
  // Lists
  createList(name: string): List;
  getLists(): List[];            // newest first

  // Todos
  createTodo(listId: string, text: string): Todo;
  getTodosByList(listId: string): Todo[];
  getTodoById(id: string): Todo | undefined;
  toggleTodo(id: string): Todo | undefined;
  deleteTodo(id: string): boolean;

  // Status
  getSnapshot(): StoreSnapshot;
}

// RouteMount — boundary between S2-A, S2-B, S3-A, S3-B and S1-B
export interface RouteMount {
  method: string;        // e.g. "GET", "POST", "PATCH", "DELETE"
  path: string;          // e.g. "/lists", "/lists/:id/todos"
  handler: (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    params: Record<string, string>
  ) => void | Promise<void>;
}
