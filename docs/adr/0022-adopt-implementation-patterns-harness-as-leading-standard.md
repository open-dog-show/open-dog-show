---
status: accepted
---

# Adopt the implementation-patterns harness as the leading implementation and layout standard (supersedes ADR-0012; aligns ADR-0014)

> Adopts the implementation-patterns harness —
> [.github/skills/implementation-patterns/](../../.github/skills/implementation-patterns/)
> (`RULES.md` E/B/V/N/T/L rules + `typescript.md` per-object TypeScript shapes) and
> [.github/skills/placement/STRUCTURE.md](../../.github/skills/placement/STRUCTURE.md)
> (canonical layout) — as the **leading, prescriptive** source for _how each object is
> implemented_ and _where each thing lives_. The harness's code snippets are prescriptive
> ("they explain what to expect"), not illustrative — the repo conforms to the shapes.
> Supersedes [ADR-0012](0012-rolegrant-as-discriminated-union-enforcing-scope-invariant.md)
> (discriminated-union aggregate — the class-based harness does not sanction it); aligns
> [ADR-0014](0014-application-layer-unit-of-work-port.md)'s event-envelope examples to the
> class-per-event-type event shape (the UnitOfWork _port_ decision stands). Architecture
> decisions stay ADR-led; AGENTS.md stays the conventions index.

## Decision

The implementation-patterns harness is the leading source for implementation patterns and layout:

- **The harness** = `implementation-patterns/RULES.md` (language-agnostic E/B/V/N/T/L rules) +
  `implementation-patterns/typescript.md` (per-object TypeScript shapes) +
  `placement/STRUCTURE.md` (canonical directory layout). Its rule IDs are the stable contract;
  the file bodies evolve by edit.
- **Code snippets are prescriptive.** The repo matches the shapes shown — class-based aggregate
  roots, class-per-event-type domain events, class/branded value objects, class
  factories/services/specifications, interface repository ports — not merely the sentiment behind
  them.

### Three-way authority

- **ADRs** lead _architecture decisions_ (bounded contexts, RLS/data ownership, tech stack,
  identity ownership, _adopting_ the layout). Immutable; changed only by supersession.
- **The harness** leads _how each object is implemented_ and _where each thing lives_. Living;
  evolves by direct edit; the rule IDs are the stable contract.
- **AGENTS.md** is the _conventions index / entry point_ (project setup, SPDX, file naming,
  ESM/NodeNext/`strict`, package management, commit signing) and _points to_ the harness for
  patterns/layout and ADRs for architecture. It is the "one source of truth" for _conventions_,
  not for implementation patterns.

### Conflict rule

Where an ADR touches implementation, the ADR owns the **decision/why** and **defers to / points
to** the harness for the **how/shape**. The harness never re-describes an architecture decision;
an ADR never re-describes an implementation pattern (it points to the harness). A **future
deliberate deviation** ADR leads over the harness for its specific point, and the harness records
the carve-out. The default direction of alignment is **repo + existing ADRs → harness**: existing
deviations are reconciled toward the harness; only a brand-new deviation ADR outranks it.

## Enforcement

The review skills already treat the harness as normative — `/clean-code-review` loads the
**E**/**N** rules, `/ddd-clean-architecture-review` loads the **B**/**T**/**L** rules and
`placement/STRUCTURE.md` (for the Screaming Structure axis). `eslint-plugin-boundaries` +
dependency-cruiser own the import-shaped subset. "Follow the harness" is therefore enforced by
review + tooling, not by hand.

## What is superseded / aligned

- **[ADR-0012](0012-rolegrant-as-discriminated-union-enforcing-scope-invariant.md)** (RoleGrant as
  a discriminated union enforcing the scope invariant) is **superseded**: the class-based harness
  sanctions a single class aggregate with runtime invariant enforcement, not a discriminated-union
  aggregate. `RoleGrant` migrates to a class; the compile-time "impossible states unrepresentable"
  guarantee is intentionally traded for runtime validation (a consequence below). ADR-0012's body
  stays as the historical record; its Status is set to `superseded by ADR-0022`.
- **[ADR-0014](0014-application-layer-unit-of-work-port.md)** is **aligned**, not superseded: its
  UnitOfWork _port_ decision is architecture (ADR-led) and stands; its event-envelope code examples
  (generic `DomainEvent<TPayload>` + `createDomainEvent` factory) are amended to point at the
  harness's class-per-event-type event shape.

## Migration scope (follow-up tickets — not part of this ADR's commit)

Full conformance to the harness shapes, across contexts:

- **Aggregate roots & entities** → classes with invariant-enforcing instance mutators (`User`,
  `Entry`, `RoleGrant`, rulesets `effective-ruleset` entities).
- **Value objects** → class (composite) / branded type (single-primitive) per the harness.
- **Domain events** → class-per-event-type (`XxxSubmitted implements DomainEvent`); reworks the
  outbox codec (event-type→class rehydration registry), the polling dispatcher, and reconciles the
  `Clock`/`EventIdGenerator` deterministic-test injection with the class constructor.
- **Factories, domain services, specifications** → classes (`OrderFactory`, `PricingService`,
  `…Specification`); the repo's module-level pure-function style for these is converted.
- **Supersede/align ADRs**: set ADR-0012 `superseded by ADR-0022`; amend ADR-0014's event examples
  with a pointer to the harness; add harness pointers to any other ADR that re-describes a pattern
  the harness owns.

## Consequences

- The repo's prevalent _functional_ style (module-level pure functions for factories/services/
  specifications; structural-interface aggregates) becomes _class-based_ to match the harness. This
  is a large, multi-context migration tracked as tickets; this ADR is only the decision.
- `RoleGrant`'s role/scope pairing is enforced at **runtime** (constructor/factory) instead of
  compile time. The "a `ShowSecretary`+`PlatformScope` pairing is a type error" guarantee is lost; a
  runtime `DomainError` replaces it. The trade-off is accepted for harness conformance.
- Domain events becoming class-per-event-type requires an event-type→class rehydration registry for
  the outbox codec and reworks the dispatcher's `DomainEvent<unknown>` consumption; the
  `Clock`/`EventIdGenerator` ports move from the `createDomainEvent` factory into the event-class
  construction path (deterministic tests are preserved by injecting the ports there).
- ADRs that re-described implementation patterns now point to the harness, so the harness is the
  single source for the _how_ and ADRs stay the record for the _why_.

## Sources

- [.github/skills/implementation-patterns/RULES.md](../../.github/skills/implementation-patterns/RULES.md)
    - [typescript.md](../../.github/skills/implementation-patterns/typescript.md) (the
      implementation-patterns harness).
- [.github/skills/placement/STRUCTURE.md](../../.github/skills/placement/STRUCTURE.md) (the
  canonical layout — the harness's placement half).
- [ADR-0012](0012-rolegrant-as-discriminated-union-enforcing-scope-invariant.md) /
  [ADR-0014](0014-application-layer-unit-of-work-port.md) (the superseded/aligned decisions).
- AGENTS.md "Coding standards" (the conventions index this ADR relates to).
