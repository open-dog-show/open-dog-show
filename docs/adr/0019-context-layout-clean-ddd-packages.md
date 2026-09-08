---
status: accepted
---

# Context layout — clean-DDD packages

> **Amended 2026-09-07 by [ADR-0020](0020-single-package-source-tree.md):** the
> per-context **package wrapper** is removed; a context lives at
> `src/<name>/` (no nested `src/`), and the `@ods/rulesets/fci` and
> `@ods/rulesets/layers` sub-path exports are now relative imports into
> `src/rulesets/`. The clean-DDD **role-folder** layout this ADR defines
> is unchanged.

> **Superseded 2026-09-07 by [ADR-0021](0021-adopt-canonical-directory-structure.md):**
> the role-folder layout (`domain/{value-objects,entities,…}`) is replaced by the
> canonical **aggregate-package** layout (`domain/model/<aggregate>/` +
> `domain/service/` + `domain/shared/`) and `application/<UseCase>/` use-case
> folders, per the `placement` skill's harness
> (`.github/skills/placement/STRUCTURE.md`). Read ADR-0021 for the
> current shape.

The repo's per-context layout adopts a clean-DDD package structure so the tactical
building blocks (value objects, entities/aggregates, domain services, ports,
repositories, events, specifications) are discoverable from the directory, not
buried in a flat `domain/`.

## Context

A flat `domain/` (as in `@ods/rulesets`) mixes value objects, ports, domain
services, and anemic data records with no signal from the layout — a reader can't
tell where each tactical role lives. The AGENTS.md file-naming rule keeps
filenames as domain concepts and leaves **directory** names free to signal role,
so the role signal belongs in the directory structure.

## Decision

Each bounded context's `src/` is organized by clean-DDD packages (kebab-case,
matching the repo convention):

    src/
      domain/
        value-objects/     # VOs (ADR-0018) + identity-less value data
        entities/          # identity-bearing domain data (anemic per ADR-0001)
        aggregates/        # aggregate roots
        ports/            # port interfaces (domain-service contracts the domain defines)
        services/         # domain service implementations (pure domain logic; ADR-0001)
        events/            # domain events (created when emitted)
        repositories/      # repository interfaces (created when persistence lands)
        specifications/    # the Specification pattern (created when used)
      application/
        use-cases/        # interactors
        ports/            # input/output ports
        services/         # application services
        commands/ queries/ dto/   # CQRS/DTOs (created when used)
      infrastructure/
        persistence/
          drizzle/        # ORM implementations (Drizzle — not EF)
          mappers/
          repositories/  # implements domain repository interfaces
        external/
        configuration/

Folders are **kebab-case** (repo convention; the generic template's PascalCase is
not used). Folders are created only when they have content (git does not track
empty dirs); the structure above is the target.

### Divergences from the generic clean-architecture template

- **No per-context `presentation/`** — ADR-0004/0006 put HTTP/API in `apps/api`
  (the composition root); contexts expose ports and `apps/api` composes/presents.
  Adding per-context `presentation/` would reverse ADR-0004/0006; that is a
  separate decision not made here.
- **`EF/` → `drizzle/`** — a TypeScript/Node repo using Drizzle (AGENTS.md:
  "Drizzle lives in infrastructure/ only"), not .NET EF.
- **kebab-case, not PascalCase** — per AGENTS.md.
- `repositories/`, `events/`, `specifications/`, `commands/`, `queries/`, `dto/`
  are created when content exists; not created empty.

## Application: rulesets domain/

`@ods/rulesets` `src/domain/` (19 files, flat) is reorganized into:

    domain/
      value-objects/   local-date, age-months, entry-ref, certificate-kind,
                       domain-ids, dog-eligibility-profile, judging-scope-results,
                       collective-competition-results
      entities/        class-definition, award-type, grade-scale, show-type, breed,
                       ruleset-layer          # anemic data records (ADR-0001)
      aggregates/      effective-ruleset      # the aggregate root
      ports/          award-policy, class-eligibility-policy,
                      collective-award-policy   # the policy port interfaces
      services/       resolve-effective-ruleset # pure domain service (compose layers)
        fci/          fci-award-policy, fci-class-eligibility-policy,
                      fci-collective-award-policy, meets-award-requirements
                      # FCI domain-service implementations (ADR-0001)

No behavior change to the domain model — pure layout. The main public barrel
(`index.ts`) is unchanged, so `apps/api` and other consumers are unaffected. The
`@ods/rulesets/testing` sub-path is renamed to `@ods/rulesets/fci` and now points
at `domain/services/fci/` (the FCI policies are domain services, not test
doubles — see "Subpath exports"). Other contexts (iam, sample, kernel) migrate
separately.

### Port interfaces vs implementations

The `domain-services/` package is split into two role packages so ports and
their implementations are in **separate directories** — a reader can tell
interface-from-impl from the directory name, not by opening the file:

- `domain/ports/` — **port interfaces**: the contracts the domain defines
  (`AwardPolicy`, `ClassEligibilityPolicy`, `CollectiveAwardPolicy`).
- `domain/services/` — **domain service implementations**: pure domain logic
  with no I/O. Holds both standalone domain services
  (`resolveEffectiveRuleset`) and pure-logic port implementations
  (`domain/services/fci/*`).

A port implementation's home is decided by **what it does**, not by the fact
that it implements a port:

| Implementation is…                                             | It's a…        | Lives in…          |
| -------------------------------------------------------------- | -------------- | ------------------ |
| Pure domain logic (no I/O, deterministic)                      | domain service | `domain/services/` |
| I/O / system-bound (persistence, HTTP, `Date.now()`, `crypto`) | adapter        | `infrastructure/`  |

This refines AGENTS.md's "ports implemented in `infrastructure/`": that rule
covers I/O-bound implementations — the repo's existing examples (`SystemClock`,
`RandomEventIdGenerator`, Drizzle repositories) all touch an external/system
concern. A pure-domain-logic port implementation is a **domain service** and
stays in the domain layer (ADR-0001: "concrete rulesets are pure domain
modules"). A future DB-driven policy adapter would implement the same port but
live in `infrastructure/`. The ESLint boundary config (`domain/**` =
`context-domain`) enforces that `domain/services/` imports no infrastructure.

### Subpath exports

`@ods/rulesets` exposes two sub-path exports that are **packaging** concerns,
orthogonal to the clean-DDD layers (they are not `domain/` / `application/` /
`infrastructure/` siblings):

- `@ods/rulesets/layers` → `src/layers/` — concrete ruleset catalog data (FCI,
  KMSH `RulesetLayer` instances); pure data (ADR-0001's data-first axis).
- `@ods/rulesets/fci` → `src/domain/services/fci/index.ts` — the FCI
  domain-service implementations of the policy ports. The code is domain-layer
  (pure logic, no I/O); the sub-path exists so the **main** `@ods/rulesets`
  export stays the **abstraction surface** (the ports + the data model).
  Downstream contexts depend on the _ports_; the composition root (`apps/api`)
  wires the FCI _domain services_.

The `iam` and `kernel` `./testing` sub-paths are a different concern: they
export genuine `Fake*` test doubles (in-memory adapters used in tests), not
domain services, and are unchanged here.

## Consequences

- Tactical roles are discoverable from the directory.
- A documented clean-DDD structure; new contexts/files have a named home.
- Import paths within a context grow longer (e.g.
  `../domain/value-objects/local-date.js`); the public barrel shields
  cross-context consumers.
- `entities/` vs `aggregates/` is a judgment call for anemic data-first records
  (ADR-0001): identity-bearing records go in `entities/`, the aggregate root in
  `aggregates/`.
- Maintains ADR-0004/0006 (no per-context presentation); reversing that is out of
  scope.

## Alternatives considered

- **Flat `domain/`**: rejected — the discoverability problem this ADR addresses.
- **Aggregate-package layout** (a folder per aggregate, co-locating its
  VO/port/service): viable for aggregate-rich contexts; for rulesets' data-first
  model, role-packages read more cleanly. May be adopted per-context when it fits.
- **Role suffixes in filenames** (`local-date.vo.ts`): rejected — conflicts with
  the AGENTS.md rule that filenames carry the domain concept, not the role.

## Sources

- ADR-0004 / ADR-0006 (architecture: contexts + apps/api composition).
- ADR-0018 (value-object patterns — the `value-objects/` contents).
- ADR-0001 (data-first hybrid — the `entities/` anemia).
