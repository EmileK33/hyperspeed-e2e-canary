# User Stories — Canary Todos API

A tiny TypeScript todo-list HTTP API backed by Postgres. This is a build-plan
**fixture** (issue #40 / #143): the stories are shaped to decompose into ~7
sessions across 4 phases (Phase 0 integration harness + 3 feature phases) with
zero file-ownership overlap. Keep them small and parallel-friendly.

## Epic 1 — Core data + server

### US-001 — In-memory + Postgres todo store
**As a** developer **I want** a typed store module **so that** routes read and
write todos without embedding SQL.

- AC-1: `createTodo`, `getTodo`, `listTodos`, `toggleTodo` are exported and typed.
- AC-2: The store connects to Postgres via `DATABASE_URL`; an integration test
  inserts and reads back a row against the fixture database.
- AC-3: A `Todo` type (`{ id, title, done }`) is exported for route handlers.

### US-002 — HTTP server bootstrap
**As a** client **I want** an HTTP server with JSON body parsing **so that**
routes can be mounted under a single app.

- AC-1: `createServer()` returns a configured app with JSON parsing enabled.
- AC-2: An unknown route returns `404` with a JSON error body.

## Epic 2 — Todo + list routes

### US-003 — Todo CRUD routes
**As a** user **I want** to create, list, and toggle todos **so that** I can
track work.

- AC-1: `POST /todos` creates a todo and returns `201` with the created row.
- AC-2: `GET /todos` returns all todos as JSON.
- AC-3: `POST /todos/:id/toggle` flips `done` and returns the updated row.

### US-004 — Saved lists
**As a** user **I want** named lists **so that** I can group todos.

- AC-1: `POST /lists` creates a named list and returns `201`.
- AC-2: `GET /lists` returns all lists.

## Epic 3 — Operational routes

### US-005 — Health probe
**As an** operator **I want** a health route **so that** load balancers can
check liveness.

- AC-1: `GET /health` returns `200` with `{ status: "ok" }`.

### US-006 — Status page
**As an** operator **I want** a status route **so that** I can see build + brand
metadata.

- AC-1: `GET /status` returns `200` with `{ version, uptimeSeconds }`.
- AC-2 **[MANUAL]**: The status JSON includes the canary brand color
  `#3a86ff` in a `brandColor` field. *(Human sign-off required — verify the exact
  hex renders in the response and matches the brand guideline.)*
