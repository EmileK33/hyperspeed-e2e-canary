// Shared domain-type contracts — owned by S0-A (Phase 0).
// All route handlers and store modules import from here so that the
// shape of every API resource is defined in one place and never drifts
// between producer (store) and consumer (routes).

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/** A single todo item. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
  /** Optional FK to the list this todo belongs to. */
  list_id?: number | null;
  created_at?: string;
}

/** A named list that can group todos. */
export interface TodoList {
  id: number;
  name: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

export interface CreateTodoBody {
  title: string;
  list_id?: number | null;
}

export interface CreateListBody {
  name: string;
}

export interface ApiError {
  error: string;
}

export interface HealthResponse {
  status: 'ok';
}

export interface StatusResponse {
  version: string;
  uptimeSeconds: number;
  brandColor: string;
}
