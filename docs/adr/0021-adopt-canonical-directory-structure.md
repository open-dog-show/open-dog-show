---
status: accepted
---

# Adopt the canonical directory-structure layout (supersedes ADR-0006/0019/0020/0014; refines ADR-0004)

> Adopts the canonical source layout
> ([`docs/architecture/canonical-directory-structure.md`](../architecture/canonical-directory-structure.md))
> — context-first, kebab-case, `src/Shared/`,
> relative imports.
> Reverses the structural decisions of ADR-0006/0020 (kernel
> naming/shape, no per-context delivery), ADR-0019 (role-packages), and ADR-0014 (flat
> use-case file); refines ADR-0004 (composition root → per-context `interfaces/` + `apps/`).
> The domain model, events, outbox, RLS, and Drizzle-behind-ports decisions are unchanged.

> **Amended 2026-09-11 (#184):** five clarifications.
>
> - **Branded id definitions** (`domain-ids.ts`) live in `domain/shared/` in every context.
> - **Policy input value objects** live beside their policy port in `domain/service/<policy>/`, not in an
>   aggregate's `value-objects/`.
> - **Event rehydration registries** live in `infrastructure/messaging/`. `infrastructure/di/` holds only the
>   `create<Ctx>Context` wiring factory.
> - **Authored ruleset data** lives in `infrastructure/persistence/bundled/`. See
>   [ADR-0025](0025-reference-sample-context-is-generator-output.md) and
>   [ADR-0029](0029-effective-ruleset-aggregate-resolved-from-layer-editions.md).
> - **"No cross-context imports"** below now has two exceptions, both through a published `index.ts` along the
>   context map: any layer may import Rulesets, and only `infrastructure/` may import Identity & Access. See
>   [ADR-0028](0028-cross-context-imports-via-index-along-context-map.md).

## Decision

Full adoption of the context-first, four-layer layout from the canonical
[`docs/architecture/canonical-directory-structure.md`](../architecture/canonical-directory-structure.md):

- **Contexts at the top of `src/`** (already done, ADR-0020).
- **Four layer folders per context**: `domain/`, `application/`, `infrastructure/`, `interfaces/`
  — `interfaces/` is the delivery layer (`http/{controllers,requests,responses}/`, `cli/`,
  `events/`), created when delivery code lands.
- **`domain/model/<aggregate>/`** aggregate-package (reverses ADR-0019): one folder per
  aggregate holding the root entity, `entities/`, `value-objects/`, `events/`, and the
  `<Aggregate>Repository` interface; cross-aggregate `domain/service/`, `domain/exception/`,
  `domain/shared/`.
- **`application/<UseCase>/`** use-case folders (reverses ADR-0014): `<UseCase>Command`,
  `<UseCase>Handler`, `<UseCase>Response`; `application/ports/` for outbound interfaces
  (`Clock`, `EventBus`, …); `application/dto/`.
- **`infrastructure/persistence/{postgres,inmemory}/`, `messaging/`, `external/`, `di/`** —
  adapters grouped by technology; in-memory test doubles live in `persistence/inmemory/`.
- **Shared kernel** renamed `src/kernel/` → `src/Shared/` with `domain/`,
  `application/ports/`, `infrastructure/` (reverses ADR-0006/0020 naming).
- **`tests/`** at the repo root mirroring `src/` (replaces co-located `__tests__/`).
- **`apps/`** optional runnable entry points; the composition root moves from `src/api/` to `apps/`.

Dependencies point inward; no cross-context imports (enforced by `eslint-plugin-boundaries`
on the new paths); ports live inward, adapters outward.

## What is preserved

ADR-0001 (data-first core), ADR-0002 (nine contexts, reference-by-ID), ADR-0005 (RLS scopes),
ADR-0013 (PrincipalId/UserId ownership), the transactional outbox, per-context migrations,
Drizzle behind repository ports.

## Consequences

- Per-context `interfaces/` is now the home for delivery; `apps/` wires and starts it. The
  single-composition-root model of ADR-0004/0006 is replaced by per-context delivery + thin
  `apps/` runners.
- `domain/model/<aggregate>/` makes the aggregate the structural unit. Rulesets' data-first
  reference types (`Class`, `AwardType`, `GradeScale`, …) live as `entities/`/`value-objects/`
  under the `effective-ruleset` aggregate, or in `domain/shared/` where genuinely cross-aggregate.
- Tests relocate to root `tests/`; the `vitest`/`plop`/boundary-lint configs move with them.
- Boundary enforcement is re-pointed at the new paths; `interfaces/` is added as a layer with
  its own inward-only rule (imports `application` + `domain`, never `infrastructure`).

## Migration (staged, each stage ends green)

1. `kernel/` → `Shared/` (four-layer split; ports to `application/ports/`; fakes to `infrastructure/`).
2. `src/**/__tests__/` → root `tests/` mirroring `src/`.
3. Per-context four-layer + `domain/model/<aggregate>/` + `application/<UseCase>/` + fakes →
   `infrastructure/persistence/inmemory/`; `interfaces/` created when delivery lands.
4. `eslint.config.js`, `vitest.config.ts`, `tsconfig.json`, `plopfile.js` + templates rewritten.
5. ADR amendments (0004/0006/0014/0019) + docs; `pnpm lint`/`typecheck`/`test` green.

## Sources

- `.github/skills/placement/STRUCTURE.md` (the harness — the canonical layout).
- ADR-0004 / ADR-0006 / ADR-0019 / ADR-0020 / ADR-0014 (the reversed/refined decisions).
