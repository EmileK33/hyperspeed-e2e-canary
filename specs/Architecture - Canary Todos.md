# Architecture — Canary Todos API

TypeScript · npm + Vitest · Postgres. A build-plan **fixture** shaped to
decompose into a Phase 0 integration harness + 3 feature phases with disjoint
file ownership. See `../EXPECTED.md` for the session/wave contract.

## Stack

- **Runtime:** Node 20, ES modules, TypeScript (strict).
- **HTTP:** a minimal framework-free server (`node:http`) with a JSON body helper.
- **Datastore:** Postgres (`pg`), connected via `DATABASE_URL`.
- **Tests:** Vitest. Integration tests live under `tests/integration/` and run
  against a fixture Postgres provisioned by the harness/CI.

## Module layout (file ownership — one owner each)

| Area | Files | Phase |
|---|---|---|
| Integration harness | `tests/integration/smoke.test.ts`, `package.json`, `vitest.workspace.ts` | 0 |
| Store | `src/store/todos.ts` | 1 |
| Server | `src/server/app.ts` | 1 |
| Todo routes | `src/routes/todos.ts` | 2 |
| List routes | `src/routes/lists.ts` | 2 |
| Health route | `src/routes/health.ts` | 3 |
| Status route | `src/routes/status.ts` | 3 |

## Shared resources

- **Fixture Postgres** — a single database shared by all integration tests.
  Provisioned **run-once** by the Phase 0 harness (schema created before any
  parallel worker runs); feature sessions read/write isolated rows.
- **`vitest.workspace.ts`** — single-owner glob registry; sessions never edit it.

## Toolchain

- `package.json` (npm) owns deps: `pg` (runtime); `vitest`, `typescript` (dev).
- Integration command: `npm run test:integration` → `vitest run tests/integration`.
- CI provisions Postgres as a native service and exports `DATABASE_URL`.

## Cross-session contracts

- `src/routes/*` import `Todo` + store functions from `src/store/todos.ts`
  (Phase 1 → Phase 2/3 dependency; producer phase precedes consumer phase).
- `src/server/app.ts` exports `createServer()`; routes mount onto it.
