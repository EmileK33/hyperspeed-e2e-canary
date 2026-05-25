# hyperspeed-canary-todos

Tiny TypeScript todo-list API. Used as a fixture target for the HyperSpeed Track D end-to-end runner validation.

## Setup

```bash
npm install
```

## Running tests

Run unit tests (excludes integration):

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

The integration command exits 0 when all integration tests pass and non-zero on failure. It is the gate for each integration wave.

## Project structure

- `src/store/types.ts` — shared type contracts (`List`, `Todo`, `Store`, `RouteMount`, etc.)
- `src/index.ts` — entry point stub
- `tests/integration/` — integration test suite
- `tests/integration/helpers.ts` — test server utilities for integration tests
