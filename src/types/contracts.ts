/** A single todo item stored in Postgres. */
export interface Todo {
  id: number;
  title: string;
  done: boolean;
  created_at?: string;
}

/** A named list that can group todos. */
export interface List {
  id: number;
  name: string;
  created_at?: string;
}

/** Standard JSON error response shape. */
export interface ApiError {
  error: string;
}

/** Pagination metadata included in list responses. */
export interface Pagination {
  total: number;
  offset: number;
  limit: number;
}
