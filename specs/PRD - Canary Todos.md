# PRD — Canary Todos

> Fixture PRD for HyperSpeed Track D (issue #40). Not a real product. Kept
> minimal so `--generate-build-plan` against this folder produces a
> bounded plan (~6–10 sessions across 3 phases) without dragging in
> open-ended scope.

## Product summary

A single-user, in-memory todo-list HTTP API in TypeScript. Lists are
tagged, todos belong to lists, todos can be marked done. No
authentication, no persistence, no UI beyond a minimal status page.

## Goals

- G1. Provide create/read/update/delete for todos and lists over HTTP.
- G2. Provide a single in-memory persistence layer used by all routes.
- G3. Expose a `/healthz` and a minimal HTML status page describing
  current store contents.

## Non-goals

- Auth, multi-user, persistence across process restarts.
- Pagination, search, rich query filters.
- Any client UI beyond the status page.

## Functional requirements

- FR-1. `POST /lists` creates a list (`{ name }`) and returns it with a
  generated `id`.
- FR-2. `GET /lists` returns all lists.
- FR-3. `POST /lists/:id/todos` creates a todo on a list with `{ text }`.
- FR-4. `GET /lists/:id/todos` returns todos on a list.
- FR-5. `PATCH /todos/:id` toggles `done`.
- FR-6. `DELETE /todos/:id` removes a todo.
- FR-7. `GET /healthz` returns `200 OK` with a JSON body
  `{ status: 'ok', uptimeMs: number }`.
- FR-8. `GET /status` returns a minimal HTML status page listing list
  count and todo count.

## Non-functional requirements

- NFR-1. All HTTP handlers run on a single in-memory store module
  (`src/store/`). No globals outside that module.
- NFR-2. Public types live in `src/store/types.ts` and are imported by
  every consumer.
- NFR-3. Each route file has an independent test file under
  `tests/sessions/`. An integration test under `tests/integration/` boots
  the server and exercises one end-to-end flow per phase boundary.
- NFR-4. The status page must render even when the store is empty.

## Acceptance

- A. `npm test` passes with every per-route test file present and green.
- A. `npm run test:integration` boots the server and exercises one
  list+todo round trip.
- A. Manual: the status page renders in a browser at `/status` with the
  expected counts. *(Manual AC — reviewers tick on the PR body.)*
