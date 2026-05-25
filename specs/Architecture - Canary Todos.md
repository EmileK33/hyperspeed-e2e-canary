# Architecture — Canary Todos

> Fixture architecture for HyperSpeed Track D (issue #40). Intentionally
> partitioned to produce non-overlapping file ownership across sessions.

## Stack

- TypeScript 5, Node 20, ES modules.
- Vitest for tests.
- `node:http` (no Express) — keep the surface area small and
  dependency-free.

## Layout

```
src/
  store/
    types.ts        // Public types: List, Todo, StoreSnapshot
    store.ts        // In-memory CRUD over Lists and Todos
  server/
    server.ts       // createServer(store) → http.Server
  routes/
    lists.ts        // /lists handlers (US-001)
    todos.ts        // /lists/:id/todos + /todos/:id handlers (US-002)
    health.ts       // /healthz handler (US-003)
    status.ts       // /status handler (US-004)
tests/
  integration/
    smoke.test.ts                   // Phase-0 placeholder; replaced by Phase-2 round-trip
    full-round-trip.test.ts         // Phase-2 integration: list+todo create + status render
  sessions/
    S1-A.test.ts                    // store
    S1-B.test.ts                    // server scaffold
    S2-A.test.ts                    // lists routes
    S2-B.test.ts                    // todos routes
    S3-A.test.ts                    // health
    S3-B.test.ts                    // status
```

## Phasing

- **Phase 0 — Integration harness.** Establish `tests/integration/`
  runner. Session: `S0-A`.
- **Phase 1 — Core.** Store module + bare server scaffold. Two parallel
  sessions: `S1-A` (store), `S1-B` (server scaffold). Neither imports
  the other; the server only depends on a `Store` interface.
- **Phase 2 — Routes.** Lists + Todos handlers in parallel: `S2-A`,
  `S2-B`. Both depend on Phase 1 exports; both edit
  disjoint files under `src/routes/`.
- **Phase 3 — Read surfaces.** Health + Status handlers in parallel:
  `S3-A`, `S3-B`.

Integration waves run after Phase 1, Phase 2, and Phase 3.

## File ownership (must be disjoint per session)

| Session | Owned files |
| --- | --- |
| S0-A | `tests/integration/smoke.test.ts`, `package.json` |
| S1-A | `src/store/store.ts`, `src/store/types.ts`, `tests/sessions/S1-A.test.ts` |
| S1-B | `src/server/server.ts`, `tests/sessions/S1-B.test.ts` |
| S2-A | `src/routes/lists.ts`, `tests/sessions/S2-A.test.ts` |
| S2-B | `src/routes/todos.ts`, `tests/sessions/S2-B.test.ts` |
| S3-A | `src/routes/health.ts`, `tests/sessions/S3-A.test.ts` |
| S3-B | `src/routes/status.ts`, `tests/sessions/S3-B.test.ts`, `tests/integration/full-round-trip.test.ts` |

## Cross-session exports

- `S1-A` exports `Store`, `List`, `Todo`, `StoreSnapshot`, `createStore()`.
- `S1-B` exports `createServer(store: Store, mounts: RouteMount[])`.
- `S2-A` exports `listsRoutes(store)` returning a `RouteMount`.
- `S2-B` exports `todosRoutes(store)` returning a `RouteMount`.
- `S3-A` exports `healthRoute(startTime)` returning a `RouteMount`.
- `S3-B` exports `statusRoute(store)` returning a `RouteMount`.

## Test contract

- Per-session test files live at `tests/sessions/<id>.test.ts` and exit
  zero in isolation (`npm test -- tests/sessions/<id>`).
- Integration wave runs `npm run test:integration`. The harness gates on
  exit code.

## Non-functional

- Zero runtime dependencies. Dev deps: `vitest`, `typescript`.
- Boot time under one second on a developer laptop.
