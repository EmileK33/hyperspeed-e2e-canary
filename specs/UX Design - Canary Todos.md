# UX Design — Canary Todos API

This is a headless JSON API; "UX" here means the response shapes and the
operator-facing status surface. Kept deliberately small (build-plan fixture).

## Response conventions

- All responses are `application/json`.
- Errors: `{ "error": string }` with the appropriate status code.
- Success bodies echo the affected resource.

## Screens / surfaces

### S1 — Todo list (client-rendered from `GET /todos`)
A flat list of todos, each with a title and a done checkbox. Toggling calls
`POST /todos/:id/toggle`.

### S2 — Lists overview (`GET /lists`)
Named lists shown as cards. Creating a list calls `POST /lists`.

### S3 — Status surface (`GET /status`)
An operator status panel rendering the JSON from `GET /status`:

- `version` — the deployed build version.
- `uptimeSeconds` — process uptime.
- `brandColor` — the canary brand color, rendered as the panel accent.
  **The brand color is exactly `#3a86ff`** (canary blue). This precise hex is
  load-bearing: it is the manual-AC token the e2e harness asserts in the PR body,
  so it must survive verbatim into the status response and the panel styling.

## Accessibility

- The status panel accent (`#3a86ff` on white) must meet WCAG AA for the adjacent
  label text; pair it with `#0b1f3a` text where used as a background.
