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

export interface Store {
  createList(name: string): List;
  getLists(): List[];

  createTodo(listId: string, text: string): Todo;
  getTodosByList(listId: string): Todo[];
  getTodoById(id: string): Todo | undefined;
  toggleTodo(id: string): Todo | undefined;
  deleteTodo(id: string): boolean;

  getSnapshot(): StoreSnapshot;
}

export interface RouteMount {
  method: string;
  path: string;
  handler: (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    params: Record<string, string>
  ) => void | Promise<void>;
}
