# GitHub Copilot workspace instructions

## Project

OpenDogShow — AGPL-3.0-only, TypeScript pnpm monorepo, modular monolith.  
Domain model: `CONTEXT.md` · Context map: `CONTEXT-MAP.md` · ADRs: `docs/adr/`.

## Every source file

Open every `.ts` and `.js` file (and every commentable config file) with the
SPDX two-liner — copyright notice **first**, identifier second:

```
// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only
```

Use `#` comments for YAML files. Files that cannot carry comments (JSON, lock
files) are covered by `REUSE.toml` bulk declarations — do not invent a
workaround.

## File naming

- **kebab-case only** — every `.ts` source file uses kebab-case. `eslint-plugin-unicorn` (`unicorn/filename-case`) enforces this at lint time.
- **Names must reflect domain language** — the subject of the file must be visible in its name. Prefer `domain-event-codec.ts` over `codec.ts`, `domain-ids.ts` over `ids.ts`, etc. A reader scanning a directory should be able to infer the domain concept without opening the file.
- Directory names are not in scope for this rule (`checkDirectories: false`).

## TypeScript rules

- **ESM-only** — `"type": "module"` in every `package.json`.
- **NodeNext** module + resolution — write `.js` extensions on every relative
  import even though the source file is `.ts`.
- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `allowImportingTsExtensions` + `noEmit` — live-source packages, no compiled
  output for internal packages.

## Architecture (ADR-0004 / ADR-0006)

```
packages/kernel/          @ods/kernel       domain primitives, ports, and shared
                                            transactional-outbox scaffolding
packages/contexts/<name>/ @ods/<name>       src/domain / application / infrastructure
apps/api/                 @ods/api          composition root
```

- Domain layer: **no ORM, no framework imports**. Drizzle lives in
  `infrastructure/` only.
- Contexts never import each other directly; `apps/api` composes them.
- Ports (`Clock`, `IdGenerator`, repository interfaces) are defined in `domain/`
  and implemented in `infrastructure/`.
- The kernel houses the shared transactional-outbox scaffolding
  (`withTransaction`/`withOutboxTransaction`, `PgOutboxWriter`,
  `PgPollingDispatcher`) and the `Clock`/`IdGenerator` production implementations
  in its `infrastructure/` layer; its `domain/` layer stays ORM-free.

## Package management

`pnpm install` / `pnpm lint` / `pnpm test` / `pnpm typecheck`. No npm or yarn.

## Commits

Sign every commit (`git commit -s`). First commit on a branch carries the full
DCO sign-off; squash to one commit per PR before merging.
