---
status: accepted
---

# Context layout — clean-DDD packages

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
        domain-services/   # domain services + their interface/ports
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
      domain-services/ award-policy, class-eligibility-policy,
                       collective-award-policy, resolve-effective-ruleset

No behavior change — pure layout; the public barrel (`index.ts`) is unchanged so
`apps/api` and other consumers are unaffected. Other contexts (iam, sample,
kernel) migrate separately.

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
