# apps/ — composition root

Runnable entry points (web, CLI, worker) that wire and start a delivery mechanism.

Per [ADR-0021](../docs/adr/0021-adopt-canonical-directory-structure.md) and the
`placement` skill's harness ([`.github/skills/placement/STRUCTURE.md`](../.github/skills/placement/STRUCTURE.md)),
delivery code lives in each context's `interfaces/` layer; an `apps/<name>/`
entry point composes the contexts (constructs the `infrastructure/` adapters and
injects them into the `application/` use cases) and starts a delivery mechanism
(e.g. an HTTP server). This replaces the earlier single `src/api/` composition
root (ADR-0004/0006/0020).

No entry point exists yet. Create `apps/<name>/` (e.g. `apps/api/`) when the
first runnable is built.
