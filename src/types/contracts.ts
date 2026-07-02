// Shared domain types — exported for every feature session to import.
// Owned by S0-A (Phase 0 scaffold). Do NOT re-declare these elsewhere.

/** A single todo item persisted in the database. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

/** A named list that groups todos. */
export interface TodoList {
  id: number;
  name: string;
}

/** Standard JSON error body returned by all route handlers. */
export interface ErrorBody {
  error: string;
}

/** Payload accepted by POST /todos. */
export interface CreateTodoBody {
  title: string;
}

/** Payload accepted by POST /lists. */
export interface CreateListBody {
  name: string;
}

/** Response shape for GET /status. */
export interface StatusBody {
  version: string;
  uptimeSeconds: number;
  brandColor: string;
}
