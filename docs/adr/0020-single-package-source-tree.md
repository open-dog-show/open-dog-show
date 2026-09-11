---
status: accepted
---

# Single-package source tree (supersedes ADR-0006 per-context packages)

> Reverses the **repository topology / scaffolding** parts of
> [ADR-0004](0004-tech-stack-typescript-modular-monolith-postgres.md) (decision 2:
> "each bounded context is its own package") and
> [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md) (the two-axis
> **package** structure). Everything else those ADRs decided — TypeScript modular
> monolith, single PostgreSQL schema-per-context, transactional outbox, Drizzle
> behind repository ports, the clean-DDD **layer** layout inside each context
> (ADR-0019), the `eslint-plugin-boundaries` enforcement — is unchanged. Only the
> _package wrapper_ around each context is removed.

> **Amended 2026-09-11 by [ADR-0028](0028-cross-context-imports-via-index-along-context-map.md) (#184):** "contexts never import each other" now has two explicit exceptions, both through a published `index.ts` along the context map: any layer may import Rulesets, and only `infrastructure/` may import Identity & Access.

## Context

ADR-0006 chose a two-axis structure: bounded contexts as the **vertical axis
(packages)** and clean-architecture layers as the **horizontal axis (folders
inside each context package)**. The stated reason was "each axis alone
under-constrains" and that package manifests make the ADR-0002 context map
"CI-checked rules, not prose."

In practice, for **one application** that is a **modular monolith** with a
**single deployable**, **single team**, and **nothing published externally**,
the package form bought very little that the lint plugin did not already
provide:

- The actual enforcement mechanism was always `eslint-plugin-boundaries`,
  which matches elements by **file-path patterns**, not package names. The same
  two-axis rules (inward-only layers; no cross-context imports; Drizzle/pg only
  in `infrastructure/`) are expressible on `src/<context>/` folder patterns
  without any `package.json`.
- The package manifests added a **second, redundant** boundary layer (a
  resolution-time import wall) on top of the lint rules — useful defense, but
  marginal for a single app where CI lint is non-negotiable.
- The cost was real: a `package.json` + `tsconfig.json` per context, `@ods/*`
  name indirection, pnpm-workspace wiring, and "add a context" being a `plop`
  generator instead of `mkdir`. ADR-0006's "live-source internal packages, no
  `dist`" meant there was **no per-package build graph** and thus **no caching
  benefit** — only ceremony.
- The "extraction path to a separate service/repo" argument was explicitly
  deferred by ADR-0004 ("nothing built against NATS yet"); splitting a
  `src/<context>/` folder into its own package when extraction actually happens
  is a mechanical refactor. Designing for it now was YAGNI.

The generic skill convention in `docs/agents/domain.md` already describes a
multi-context repo as `src/<context>/` — simpler to read and navigate, and the
shape this repo now adopts.

## Decision

**Collapse the pnpm workspace into a single root package.** The repo is one
application; bounded contexts are **folders** under `src/`, not workspace
packages. There is no `@ods/*` package scope, no per-context `package.json` or
`tsconfig.json`, and no `pnpm-workspace.yaml` workspace list.

### Target structure

```
src/
  kernel/              domain primitives, ports, shared outbox scaffolding
    domain/  infrastructure/  testing/  __tests__/  index.ts
  test-kit/            Testcontainers harness + migration runner
  <name>/              one folder per bounded context
    domain/  application/  infrastructure/  __tests__/  index.ts
  api/                 composition root (lands later; was apps/api)
```

The clean-DDD **role folders inside each context** (ADR-0019) are unchanged —
`domain/{value-objects,entities,aggregates,ports,services,events,repositories}`,
`application/{use-cases,ports,services,…}`, `infrastructure/{persistence/…}`.
Only the package wrapper is gone; the per-context `src/` nesting is dropped
(the repo already has one `src/`), so a context lives at `src/<name>/`.

### Import resolution — pure relative imports

Cross-module imports use **relative paths with `.js` extensions** (NodeNext),
no path aliases, no `#` subpath imports. A context file imports the kernel as
e.g. `../../kernel/index.js`; the kernel barrel (`src/kernel/index.ts`) is
the single public surface, exactly as the old `@ods/kernel` export was.

Contexts still **never import each other**; the composition root (`src/api/`,
future) wires them. Intra-context imports stay relative (`../domain/entry.js`),
unchanged by the migration.

### Boundary enforcement — ported to path patterns

`eslint-plugin-boundaries` is retained and re-pointed at the new paths. The
element taxonomy becomes path-based:

- `kernel` — `src/kernel/**` (the shared kernel; importable by any context
  layer, mirroring the old `allowKernel`).
- `context-domain` / `context-application` / `context-infrastructure` —
  `src/*/domain|application|infrastructure/**`, capturing the context
  name for same-context constraints.
- `context-index` file category — `src/*/index.ts`.

The policies are otherwise identical to ADR-0006: `default: 'disallow'`;
inward-only layers; same-context capture prevents cross-context relative
imports (an import from `src/sample/…` to `src/iam/…`
matches a `context-*` element with a **different** captured context name, so it
falls through `default: 'disallow'`); Drizzle/pg only in `infrastructure/`;
Node core always allowed. The `'boundaries/flag-as-external'` setting for
`@ods/*` is removed (no such packages exist).

### What is preserved unchanged

- ADR-0001 (data-first pure core), ADR-0002 (nine event-integrated contexts,
  reference-by-ID), ADR-0005 (RLS scopes), ADR-0014 (per-context UnitOfWork
  port), ADR-0019 (clean-DDD role folders), ADR-0013 (PrincipalId in kernel,
  UserId owned by IAM).
- The transactional outbox, polling dispatcher, per-context migrations, RLS
  setup, and the `plop` context generator (re-targeted to `src/<name>/`
  with relative kernel imports).
- `pnpm` remains the package manager; `tsc` / `vitest` / `eslint` tooling is
  unchanged.

## Considered options

- **Keep per-context packages (status quo, ADR-0006)** — rejected for the
  marginal-benefit / real-ceremony reasons above. The redundant import wall and
  self-documenting `exports` were not worth the per-context manifest boilerplate
  for a single deployable.
- **Single package, but keep `@ods/*` as tsconfig `paths` aliases** — rejected:
  retains an indirection layer the simplicity goal argues against, and
  NodeNext's runtime resolver ignores `paths` (would need a parallel vitest
  alias), adding config surface for no structural benefit.
- **Single package, Node-native `#kernel` subpath imports** — viable and clean,
  but rejected for this migration: it rewrites every kernel import to a new
  specifier (`#kernel`) for a cosmetic gain, increasing churn and risk. Relative
  imports are chosen instead. `#`-imports can be revisited if deep relative
  paths become a pain.
- **Pure relative imports (chosen)** — most literal "one application"; no
  aliases, no resolver config. The cost is deep relative paths from context
  files to the kernel (`../../kernel/index.js`), accepted as the price of
  zero indirection.

## Consequences

- **Simpler to read and navigate:** one `src/` tree, no `@ods/*` indirection, no
  per-context manifests. "Add a context" is `mkdir src/<name>` (the
  `plop` generator still stamps the full deep shape, now there).
- **Boundary enforcement is lint-only.** The resolution-time import wall that
  package manifests provided is gone. A developer who bypasses lint (or runs
  bare `tsc`) can compile a cross-context import. This is an accepted trade-off:
  CI lint is the enforcement gate, as it was the _real_ gate before (the
  manifests were belt-and-suspenders).
- **ADR-0013 specifier-level ban is removed from lint.** ADR-0006's
  `boundaries/dependencies` `disallow` clause that blocked importing
  `UserId`/`asUserId`/`ExhibitorId`/`asExhibitorId` _specifiers_ from
  `@ods/kernel` was keyed on the `@ods/kernel` module source string. With
  relative imports there is no such module source to match, so that clause is
  dropped. **The invariant still holds** because the kernel barrel does not
  export those symbols (per ADR-0013 they live in `src/iam/`); importing
  them from the kernel is a `tsc` error ("Module has no exported member"). The
  cross-context import ban additionally prevents a downstream context from
  importing IAM's `UserId` directly. We lose one layer of defense-in-depth; the
  primary guarantee is unchanged.
- **`pnpm-workspace.yaml` loses its `packages` list** (the `allowBuilds` block is
  retained for build-allowance config). The repo is a single root package.
- **Dependency versions consolidate** to the root `package.json`; the abandoned
  empty `packages/persistence-pg` stub is deleted.
- **Extraction to a separate service/repo**, if ever needed, starts by lifting a
  `src/<name>/` folder into its own package and re-introducing a
  workspace entry — a mechanical change, deferred until warranted (ADR-0004's
  NATS path remains the named forward-target).

## Migration

Recorded as executed in the commit that introduces this ADR. Mechanical steps:

1. `git mv` each `packages/<x>/src` to `src/<x>` (`kernel`, `test-kit`) and each
   `packages/contexts/<x>/src` to `src/<x>` (drops the per-package
   `src/` nesting).
2. Rewrite `@ods/kernel` → `../../kernel/index.js` and `@ods/test-kit` →
   `../../test-kit/index.js` across `src/**` (uniform depth-3
   relative path for the context files that import them).
3. Re-point `eslint.config.js` boundary element patterns at `src/*/…`
   and `src/kernel/**`; add a `kernel` element type; remove
   `boundaries/flag-as-external` and the ADR-0013 specifier `disallow` clause.
4. Update `tsconfig.json` `include`, `vitest.config.ts` /
   `vitest.integration.config.ts` `include`, and `plopfile.js` +
   `plop-templates/**` output paths and kernel imports to the new layout.
5. Consolidate dependencies into the root `package.json`; remove
   `pnpm-workspace.yaml` `packages`; delete `packages/` (manifests, tsconfigs,
   the empty `persistence-pg` stub) and the per-package `node_modules`.
6. Update `scripts/__tests__/boundary-lint.test.ts` to the path-based model
   (cross-context relative-import ban; the UserId-ownership cases become a
   `tsc` concern and are removed with a pointer to this ADR).
7. Update cross-references: `AGENTS.md`, `CONTEXT.md`, `CONTEXT-MAP.md`,
   `README.md`, and amendment notes on ADR-0004 / ADR-0006 / ADR-0014 / ADR-0019.
8. `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` green.

## Sources

- ADR-0004 / ADR-0006 (the reversed scaffolding decisions).
- ADR-0013 (identity ownership — the one enforcement nuance this changes).
- ADR-0019 (clean-DDD role folders — preserved, only the package wrapper goes).
- `docs/agents/domain.md` (the `src/<context>/` convention this repo now matches).
