---
status: accepted
---

# Kennel-club rulesets are data-first composable policies, not core code

## Context

The platform must serve many kennel clubs (FCI, the Belgian member SRSH/KMSH first, later AKC/KC) whose show rules differ along ~10 axes (class list and eligibility, breed/group/variety taxonomy, grade scale, award vocabulary and conditions, title-earning economics, propose-vs-confirm workflow, reserve-upgrade logic, show taxonomy, breed-recognition gates, judge-competency). The core domain (Show, Entry, Dog, Judge, Placement) must stay **kennel-club-agnostic** and must never name a specific club. See the research on the `research/fci-ruleset` and `research/belgium-ruleset` branches.

## Decision

A **Ruleset** is a **data-first hybrid**:

- **Declarative domain data** for the enumerable/parametric axes: `ClassDefinition` (+ eligibility parameters), breed/`Variety`/`Group` taxonomy, `GradeScale`, `AwardType`, `TitleType`, `ShowType`.
- **Three deep domain policy ports** for the irreducibly algorithmic axes, owned by the domain core:
  - `ClassEligibilityPolicy` — is a Dog eligible for a Class at a Show/date?
  - `AwardPolicy` — which Awards are *eligible* from a judging unit's grades/placements, and are the judge's *actual* (discretionary) award choices valid? Award grant is a judge decision (input), not a pure computation (output).
  - `TitlePolicy` — given a Dog's Award history, which Titles are now earned?

**Composition:** Rulesets compose. A Show references a resolved **`Effective Ruleset`** — a single snapshot the domain operates on — composed from a national base layer (SRSH) plus **show-type-selected layers** (e.g. FCI-CACIB only for CACIB shows). Merge semantics are additive with explicit override; each policy port is bound exactly once.

**Layering & placement (clean architecture):** the ports and data shapes live in the **domain layer**; concrete rulesets (FCI, SRSH, later AKC/KC) are **pure domain modules** in their own package that depend only on the domain core (dependency inversion — the core never references them). Infrastructure only *loads* the declarative data and *wires* the policy implementations.

**Versioning:** the `Effective Ruleset` is snapshotted and **versioned onto each Show at setup**, so a Show is judged under the rules in force on its date and is immune to later ruleset edits (e.g. the SRSH title-rule change of 2025-10-01).

## Considered options

- **Fully declarative data + a rule-expression language** — rejected: forces inventing a near-Turing-complete DSL for award-eligibility and title-earning; high complexity, poor testability.
- **Behavioural policy / Strategy entirely in code** — rejected: every trivial vocabulary difference (a new class, a renamed grade) would need code; loses the "add a ruleset by authoring data" goal.
- **Data-first hybrid** — chosen: most axes are data (add a ruleset ≈ author data), only ~3 are code; deep, narrow ports; clean DDD fit.

## Consequences

- Adding a **new club that resembles an existing one** is mostly data authoring; a genuinely different scoring model needs only new policy implementations, not core changes.
- **AKC/KC sanity check (passes):** AKC's 7 groups, its class list, and its show types slot in as data; its **points/majors** system and **15-points-incl-two-majors** championship are absorbed by `AwardPolicy` + `TitlePolicy` implementations — with **no FCI-CACIB layer** composed (AKC is a standalone base). This actually *validates* why award-derivation and title-earning must be code ports rather than data.
- The domain core has zero references to any club; ruleset modules are independently testable in isolation.
- Cost: a small amount of composition/resolution machinery, and a versioning/snapshot mechanism on Shows.
