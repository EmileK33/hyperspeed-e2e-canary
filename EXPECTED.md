# Expected outputs — Canary build plan

This file documents what the canary's source specs (`specs/`) should
produce when run through `hyperspeed --generate-build-plan` and then
through `agents/build-plan/runner-template/run-build.mjs`.

The harness (`tests/e2e/run-canary.mjs`) asserts against this contract.
If the build-plan agent legitimately changes its session naming, file
ownership splits, or wave ordering, **update this file in the same
commit** so the contract stays meaningful.

## Sessions

Seven sessions across four phases (phase 0 = integration harness +
three feature phases). Concrete IDs may shift if the agent renames
them; assertions match by *count per phase* and *file ownership* rather
than literal IDs where possible.

| Phase | Expected sessions | What they own | Manual ACs |
| --- | --- | --- | --- |
| 0 | 1 (S0-A) | `tests/integration/smoke.test.ts`, `package.json` | 0 |
| 1 | 2 (S1-A, S1-B) | store/* + server/* | 0 |
| 2 | 2 (S2-A, S2-B) | routes/lists.ts + routes/todos.ts | 0 |
| 3 | 2 (S3-A, S3-B) | routes/health.ts + routes/status.ts | **1** (`US-004 AC-2`, canary brand color) |

Total sessions: **7**. Total PRs opened on a clean run: **7**.

## Waves

Manifest waves should interleave feature and integration:

```
W0  feature      phase 0 — 1 session
W1  integration  integration-0  → npm run test:integration
W2  feature      phase 1 — 2 sessions
W3  integration  integration-1  → npm run test:integration
W4  feature      phase 2 — 2 sessions
W5  integration  integration-2  → npm run test:integration
W6  feature      phase 3 — 2 sessions
W7  integration  integration-3  → npm run test:integration
```

Integration command: `npm run test:integration`.

## PR titles

Each session opens one PR titled `<session-id>: autonomous build`,
e.g. `S2-A: autonomous build`. Branch: `bp/<run-id>/<session-id>`.

## Manual ACs

Exactly one session — the one owning `src/routes/status.ts` (US-004) —
should carry a `[MANUAL]` AC for the canary brand color. The harness
asserts that *some* PR body contains a checkbox referencing
`#3a86ff` or wording matching the canary brand color AC.

## Integration-wave behavior

The integration command runs against the *host* working tree
(the canary checkout in the throwaway repo), not inside session
worktrees. The runner halts on first non-zero exit; downstream feature
waves do not fire.

## Notes on robustness

The build-plan agent is non-deterministic. To keep the harness from
flaking on cosmetic wording changes:

- Match session count per phase, not exact session names.
- Match PR title pattern (`/^S\d+-[A-Z]: autonomous build$/`).
- Match the `[MANUAL]` AC by the literal `#3a86ff` token (we picked a
  unique color string in the UX spec specifically so it would survive
  agent rewording).
- Tolerate the integration wave running `npm run test:integration` or
  `npm test -- tests/integration` — both are valid expressions of the
  same gate; the manifest builder defaults to the former.
