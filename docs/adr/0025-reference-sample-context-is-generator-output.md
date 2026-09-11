---
status: accepted
---

# The reference sample context is generator output (two generators, one aggregate per ownership scope)

> Decided in #184 (DDD / Clean Architecture full-tree review remediation); implemented
> by #188. Amends the context-generator parts of
> [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md) and
> [ADR-0014](0014-application-layer-unit-of-work-port.md) ("The plop template"). The
> generated _shape_ follows [ADR-0026](0026-aggregates-take-typed-owner-ids-not-transaction-scope.md),
> [ADR-0027](0027-roots-record-events-unit-of-work-stamps-envelope.md),
> [ADR-0028](0028-cross-context-imports-via-index-along-context-map.md) and the
> implementation-patterns harness.

## Context

- `src/sample` arrived with the foundation build phase as an "RLS scaffold and sample
  bounded context" (`entry`/`show`). It is not in `CONTEXT-MAP.md`, and no context
  imports it.
- The plop template's `Item` and the sample's `Entry`/`Show` were two hand-maintained
  copies of the same reference. They drifted: `Entry` moved to the ADR-0022 class shape,
  `Item` did not, and about eight review findings came from that gap alone.
- The sample took the glossary terms **Entry** and **Show** with conflicting meanings (a
  Club-owned Entry, the Dog as free text) in the one place new contexts copy from.
- The sample holds the only real-Postgres coverage of the kernel's outbox and RLS
  plumbing. Its two tables exercise the `club` and hybrid policies. The template stamped
  only `club`, and the `exhibitor` and `platform` policies ADR-0005 promises were never
  built.

## Decision

- **Two generators.**
    - `new:context <name>` stamps the skeleton: the unit-of-work port and its Postgres and
      in-memory implementations, the bootstrap and outbox migrations, the event registry
      (`infrastructure/messaging/`), the `create<Ctx>Context` wiring factory
      (`infrastructure/di/`) and the narrow `index.ts`.
    - `new:aggregate <context> <name> --scope club|exhibitor|hybrid|platform` stamps an
      aggregate: the class root, repository port, `create-<agg>` and `rename-<agg>` use
      cases, the table with the matching ADR-0005 RLS policy, the Drizzle repository, and
      tests mirroring `src/`.
- **`src/sample` is exactly the generators' output**, checked in: `new:context sample`
  plus one `new:aggregate` per scope, using neutral placeholder vocabulary. CI regenerates
  it and fails on any diff, so the template is the single source and `sample` is its
  executable proof.
- **`Entry` and `Show` leave `sample`.** The real aggregates belong to Entries &
  Registration (#18) and Show Organisation (#17).

## Considered options

- **One generator with a scope prompt**: rejected. `sample` could show only one scope, the
  hybrid and exhibitor RLS tests would have to move into the kernel, and real contexts get
  nothing from the generator after day one.
- **`new:context` always stamps two aggregates (club + hybrid)**: rejected. Every real
  context starts by deleting an example, and `exhibitor` and `platform` stay unbuilt.
- **Delete `sample` and generate a throwaway context in CI**: rejected. Nothing checked in
  shows what the generator emits, so template changes cannot be reviewed as code.
- **Promote `sample` to the real Entries and Show contexts now**: rejected. It would design
  Ownership, Dog identity and the entry window as a side effect of a review cleanup.
- **Keep `sample` as a documented reference context**: rejected. Two hand-maintained copies
  drift again.

## Consequences

- All four ADR-0005 policy templates (`club`, `exhibitor`, hybrid, `platform`) are built and
  covered by integration tests.
- A template change appears as a diff under `src/sample` and `tests/sample` in the same
  pull request.
- `sample` identifiers are placeholders; ubiquitous-language review does not apply to them.
- Real contexts run `new:aggregate` for every aggregate they add, so the generator keeps
  paying for itself.
