# UX Design — Canary Todos

> Fixture UX spec for HyperSpeed Track D (issue #40). The canary is API
> first; there is only one human-facing surface (`/status`).

## Surfaces

- **`/status`** — minimal HTML page. One `<h1>Canary Todos</h1>` header
  in canary brand color `#3a86ff`. Two `<dl>` blocks below: "Lists:
  &lt;count&gt;" and "Todos: &lt;count&gt;". Renders cleanly when both
  counts are zero (no "NaN", no blank body).
- **`/healthz`** — JSON only. Not a human surface.

## Brand

- Primary color: `#3a86ff`.
- System font stack: `system-ui, -apple-system, Segoe UI, sans-serif`.

## Wireframe (status page)

```
+---------------------------------------+
|  Canary Todos                         |  ← h1 in #3a86ff
+---------------------------------------+
|  Lists                                |
|  3                                    |
|                                       |
|  Todos                                |
|  7                                    |
+---------------------------------------+
```

## Out of scope

- A real frontend, client routing, CSS framework, state management.
- Any non-`/status` rendered HTML.
