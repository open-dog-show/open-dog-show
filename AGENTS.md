## Agent skills

### Issue tracker

Issues live in GitHub Issues (`pslits/open-dog-show`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — `CONTEXT-MAP.md` + `CONTEXT.md` at the repo root + `docs/adr/`. Per-context `CONTEXT.md` lives at `src/<context>/CONTEXT.md` when code lands. See `docs/agents/domain.md`.

## Coding standards

The canonical coding standards. GitHub Copilot (`.github/copilot-instructions.md`)
and Cline (`.clinerules/`) are thin pointers to this section, so every agent
follows one source of truth and the docs never drift apart.

### Documentation authority

Three sources share the "how to write code" space; each leads a different concern (see
[ADR-0022](docs/adr/0022-adopt-implementation-patterns-harness-as-leading-standard.md)):

- **The harness** — [.github/skills/implementation-patterns/](.github/skills/implementation-patterns/)
  (`RULES.md` E/B/V/N/T/L rules + `typescript.md` per-object TypeScript shapes) and
  [.github/skills/placement/STRUCTURE.md](.github/skills/placement/STRUCTURE.md) (canonical layout)
  — is the **leading, prescriptive** source for _how each object is implemented_ and _where each
  thing lives_. Its code snippets are prescriptive; the repo conforms to the shapes. It evolves by
  edit; the rule IDs are the stable contract.
- **ADRs** ([docs/adr/](docs/adr/)) lead _architecture decisions_ (bounded contexts, RLS/ownership,
  tech stack, identity ownership). Immutable; changed by supersession. Where an ADR touches
  implementation it owns the _why_ and **points to** the harness for the _how_.
- **This section** is the _conventions index_ — project setup, SPDX, file naming, ESM/NodeNext/
  `strict`, package management, commit signing — and points to the harness for patterns/layout and
  ADRs for architecture.

**Deviation ADR.** A future ADR that deliberately deviates from the harness leads over it for that
specific point; the harness records the carve-out. Existing deviations are reconciled _toward_ the
harness.

### Project

OpenDogShow — AGPL-3.0-only, TypeScript pnpm single-package repo, modular monolith.  
Domain model: `CONTEXT.md` · Context map: `CONTEXT-MAP.md` · ADRs: `docs/adr/`.

### Every source file

Open every `.ts` and `.js` file (and every commentable config file) with the
SPDX two-liner — copyright notice **first**, identifier second:

```
// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only
```

Use `#` comments for YAML files. Files that cannot carry comments (JSON, lock
files) are covered by `REUSE.toml` bulk declarations — do not invent a
workaround.

### File naming

- **kebab-case only** — every `.ts` source file uses kebab-case. `eslint-plugin-unicorn` (`unicorn/filename-case`) enforces this at lint time.
- **Names must reflect domain language** — the subject of the file must be visible in its name. Prefer `domain-event-codec.ts` over `codec.ts`, `domain-ids.ts` over `ids.ts`, etc. A reader scanning a directory should be able to infer the domain concept without opening the file.
- Directory names are not in scope for this rule (`checkDirectories: false`).

### TypeScript rules

- **ESM-only** — `"type": "module"` in `package.json`.
- **NodeNext** module + resolution — write `.js` extensions on every relative
  import even though the source file is `.ts`.
- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `allowImportingTsExtensions` + `noEmit` — live-source, no compiled output.

### Architecture (ADR-0004 / ADR-0006 / ADR-0020 / ADR-0021)

The repo follows the canonical directory-structure layout
(`docs/architecture/canonical-directory-structure.md`):
context-first, four-layer clean architecture.

```
src/Shared/              shared kernel: domain/, application/ports/, infrastructure/
src/<name>/              a bounded context:
  domain/model/<aggregate>/   root entity, entities/, value-objects/, events/, <Aggregate>Repository
  domain/service/  domain/shared/   cross-aggregate services, base types
  application/<UseCase>/       use-case folder; application/ports/ (outbound), application/dto/
  infrastructure/persistence/{postgres,inmemory}/  + messaging/ + external/ + di/
  interfaces/                  delivery: http/{controllers,requests,responses}/, cli/, events/ (when delivery lands)
tests/                   mirrors src/
apps/                    optional runnable entry points (composition root)
```

- Domain layer: **no ORM, no framework imports**. Drizzle lives in
  `infrastructure/persistence/` only.
- Dependencies point inward: `interfaces`/`infrastructure` → `application` → `domain`.
  `interfaces` imports `application`+`domain` (never `infrastructure`);
  `infrastructure` imports `application`+`domain` (never `interfaces`).
- Contexts never import each other; `apps/` (or `src/api/`) composes them.
- Ports live inward (interfaces in `domain/` or `application/ports/`); adapters
  outward in `infrastructure/`. `Clock`/`EventIdGenerator` are domain ports
  (used by domain event creation) — they live in `src/Shared/domain/`.
- Imports are **relative** (e.g. `../../Shared/index.js`); there is no `@ods/*`
  package scope. Context-zone and layer boundaries are enforced by
  `eslint-plugin-boundaries` on `src/` path patterns.

### Context layout (ADR-0019 / ADR-0021)

Each context (`src/<name>/`) uses aggregate-package + use-case folders:
`domain/model/<aggregate>/` (root entity, `entities/`, `value-objects/`,
`events/`, `<Aggregate>Repository` interface), `domain/service/`, `domain/shared/`;
`application/<UseCase>/` (Command/Handler/Response), `application/ports/`,
`application/dto/`; `infrastructure/persistence/{postgres,inmemory}/`, `messaging/`,
`external/`, `di/`; `interfaces/http/{controllers,requests,responses}/`, `cli/`,
`events/`. Folders are created only when they have content. In-memory test doubles
live in `infrastructure/persistence/inmemory/`. Tests live under root `tests/`
mirroring `src/`.

### Package management

`pnpm install` / `pnpm lint` / `pnpm test` / `pnpm typecheck`. No npm or yarn.

### Commits

Sign every commit (`git commit -s`). First commit on a branch carries the full
DCO sign-off; squash to one commit per PR before merging.
