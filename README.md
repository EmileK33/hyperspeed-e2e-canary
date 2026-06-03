# app

TypeScript todo-list API built on Node.js 20 with `node:http` and `pg`.

## Running integration tests

Requires a running Postgres instance. Set `DATABASE_URL` or accept the default:

```bash
npm run test:integration
```

The global setup (`tests/integration/setup.ts`) defaults `DATABASE_URL` to
`postgres://postgres:postgres@localhost:5432/todos_test` and provisions the
`todos` and `lists` schema before any tests run. Schema provisioning is
idempotent and safe for concurrent workers (uses `pg_advisory_xact_lock` +
`CREATE TABLE IF NOT EXISTS`).

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/todos_test` | Postgres connection string |

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Type-check the project (`tsc`) |
| `npm test` | Run all tests |
| `npm run test:integration` | Run integration tests only |
