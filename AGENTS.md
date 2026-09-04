## Agent skills

### Issue tracker

Issues live in GitHub Issues (`pslits/open-dog-show`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` at the repo root + `docs/adr/`. See `docs/agents/domain.md`.

## Coding standards

The canonical coding standards. GitHub Copilot (`.github/copilot-instructions.md`)
and Cline (`.clinerules/`) are thin pointers to this section, so every agent
follows one source of truth and the docs never drift apart.

### Project

OpenDogShow — AGPL-3.0-only, TypeScript pnpm monorepo, modular monolith.  
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

- **ESM-only** — `"type": "module"` in every `package.json`.
- **NodeNext** module + resolution — write `.js` extensions on every relative
  import even though the source file is `.ts`.
- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `allowImportingTsExtensions` + `noEmit` — live-source packages, no compiled
  output for internal packages.

### Architecture (ADR-0004 / ADR-0006)

```
packages/kernel/          @ods/kernel       domain primitives, ports, and shared
                                            transactional-outbox scaffolding
packages/contexts/<name>/ @ods/<name>       src/domain / application / infrastructure
apps/api/                 @ods/api          composition root
```

- Domain layer: **no ORM, no framework imports**. Drizzle lives in
  `infrastructure/` only.
- Contexts never import each other directly; `apps/api` composes them.
- Ports (`Clock`, `EventIdGenerator`, repository interfaces) are defined in `domain/`
  and implemented in `infrastructure/`.
- The kernel houses the shared transactional-outbox scaffolding
  (`withTransaction`/`withOutboxTransaction`, `PgOutboxWriter`,
  `PgPollingDispatcher`) and the `Clock`/`EventIdGenerator` production implementations
  in its `infrastructure/` layer; its `domain/` layer stays ORM-free.

### Value objects (ADR-0018)

Three patterns, by whether the value space has invariants:

- **Validating class VO** (constrained value space or behavior, e.g. `LocalDate`):
  a `class` with `readonly #` private fields (runtime encapsulation + nominal —
  bare literals rejected), a private constructor + static validating factory
  (`of`), read-only accessors, `equals()` value equality, and side-effect-free
  methods that return new instances. **Compare via `equals()`, never `===` and
  never as a `Set`/`Map` key** without a derived primitive key — the language uses
  reference identity. Domain-layer, framework-free. Reference impl:
  `packages/contexts/rulesets/src/domain/local-date.ts`.
- **Branded opaque type** (IDs/units, e.g. `ShowId`, `AgeMonths`, `EntryRef`):
  `type X = Brand<T, 'X'>` + an `asX` cast at the boundary. No validation for
  opaque IDs (generated/assigned, not user-typed); when the value has a
  **format/range invariant**, the cast becomes a validating factory that throws
  (e.g. `asEventType`). Value equality/immutability come from the primitive.
- **Closed-set vocabulary** (fixed enums, e.g. `CertificateKind`):
  `export const X = { … } as const` + `export type X = (typeof X)[keyof typeof X]`.

Never store a mutable object (`Date`, array) reachable for mutation behind a
TS-only `private`/`readonly` — use a `#` field and/or an immutable primitive.

### Package management

`pnpm install` / `pnpm lint` / `pnpm test` / `pnpm typecheck`. No npm or yarn.

### Commits

Sign every commit (`git commit -s`). First commit on a branch carries the full
DCO sign-off; squash to one commit per PR before merging.
