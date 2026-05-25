# Canary project — `hyperspeed-canary-todos`

Tiny TypeScript todo-list API. Exists **only** as the target project that
`tests/e2e/run-canary.mjs` exercises the Track B Node runner against
(issue #40 / Track D).

This is not a published package. It is a fixture. Treat it like one:

- `package.json`, `tsconfig.json`, `npm test`, `npm run test:integration`
  are real and must work — that is the whole point.
- `src/` is intentionally near-empty. The canned source specs in
  `../specs/` describe what sessions should build; the canary's starting
  state is "fresh npm init + vitest + one passing smoke test".
- Session output never lands here. The harness copies this dir into a
  scratch checkout of the throwaway test repo on every run.

To use directly (sanity check the scripts work):

```bash
cd tests/e2e/canary-project
npm install
npm test               # vitest run
npm run test:integration
```

See [tests/e2e/README.md](../README.md) for the full harness flow.
