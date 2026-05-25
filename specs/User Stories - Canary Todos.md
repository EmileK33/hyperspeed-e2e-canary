# User Stories — Canary Todos

> Fixture user stories for HyperSpeed Track D (issue #40). Four stories,
> sized to fan out across 3 phases with one or two parallel sessions per
> feature phase.

## US-001 — Lists CRUD

**As a** todo user **I want** to create and list named todo lists **so that** I can organize todos by context.

### Acceptance criteria

- AC-1. `POST /lists` with `{ name: "Shopping" }` returns `201` and a
  JSON body with `{ id, name }`.
- AC-2. `GET /lists` returns an array of every list created so far,
  newest first.
- AC-3. Names are trimmed; whitespace-only names return `400`.

## US-002 — Todos CRUD

**As a** todo user **I want** to add, toggle, and remove todos on a list **so that** I can track progress.

### Acceptance criteria

- AC-1. `POST /lists/:id/todos` with `{ text: "Milk" }` returns `201`
  with `{ id, listId, text, done: false }`.
- AC-2. `GET /lists/:id/todos` returns the todos on that list.
- AC-3. `PATCH /todos/:id` toggles `done` and returns the updated todo.
- AC-4. `DELETE /todos/:id` returns `204` and the todo no longer appears.
- AC-5. Operations on unknown ids return `404`.

## US-003 — Healthcheck

**As a** deployer **I want** a `/healthz` endpoint **so that** I can wire
the canary into uptime monitoring.

### Acceptance criteria

- AC-1. `GET /healthz` returns `200` with JSON
  `{ status: 'ok', uptimeMs: number }` where `uptimeMs >= 0`.

## US-004 — Status page

**As a** human visitor **I want** a `/status` HTML page **so that** I can
see store contents at a glance.

### Acceptance criteria

- AC-1. `GET /status` returns `200` with `Content-Type: text/html` and
  the rendered counts of lists and todos.
- AC-2. The page renders with the canary brand color `#3a86ff` for the
  header. *(Manual AC — visual check.)*
- AC-3. The page is readable when the store is empty (no NaN, no blank
  body).
