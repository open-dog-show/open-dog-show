---
status: accepted
---

# Kennel-club rulesets are data-first composable policies, not core code

> **Amended 2026-07-29:** Titles are owner-asserted data on the Dog, not computed — `TitlePolicy` removed, so the abstraction has **two** policy ports (`ClassEligibilityPolicy`, `AwardPolicy`). See ADR-0002.

> **Amended 2026-08-04:** Collective competitions (Brace/Couple, Breeders’ Group, Progeny Group) are judged on a group of Dogs, not a single Dog, and have structurally different inputs to individual-class judging. A **third** policy port — `CollectiveAwardPolicy` — is added. It is separate from `AwardPolicy` to keep each port’s inputs coherent; merging them would widen the port to the point where neither half is usable in isolation.

## Context

The platform must serve many kennel clubs (FCI, the Belgian member SRSH/KMSH first, later AKC/KC) whose show rules differ along ~10 axes (class list and eligibility, breed/group/variety taxonomy, grade scale, award vocabulary and conditions, title-earning economics, propose-vs-confirm workflow, reserve-upgrade logic, show taxonomy, breed-recognition gates, judge-competency). The core domain (Show, Entry, Dog, Judge, Placement) must stay **kennel-club-agnostic** and must never name a specific club. See the research on the `research/fci-ruleset` and `research/belgium-ruleset` branches.

## Decision

A **Ruleset** is a **data-first hybrid**:

- **Declarative domain data** for the enumerable/parametric axes: `ClassDefinition` (+ eligibility parameters), breed/`Variety`/`Group` taxonomy, `GradeScale`, `AwardType`, `TitleType`, `ShowType`.
- **Two deep domain policy ports** for the irreducibly algorithmic axes, owned by the domain core:
    - `ClassEligibilityPolicy` — is a Dog eligible for a Class at a Show/date? (reads the Dog's owner-asserted Titles where a Class requires one)
    - `AwardPolicy` — which Awards are _eligible_ from a judging unit's grades/placements, and are the judge's _actual_ (discretionary) award choices valid? Award grant is a judge decision (input), not a pure computation (output).

    **Titles are not computed.** A Title is owner-asserted data on the Dog (see [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md) / ADR-0002); the platform never derives or confirms Titles, so there is no title policy. The ruleset still owns the _set_ of Title types (`TitleType`) as the vocabulary an owner selects from.

**Composition:** Rulesets compose. A Show references a resolved **`Effective Ruleset`** — a single snapshot the domain operates on — composed from a national base layer (SRSH) plus **show-type-selected layers** (e.g. FCI-CACIB only for CACIB shows). Merge semantics are additive with explicit override; each policy port is bound exactly once.

**Layering & placement (clean architecture):** the ports and data shapes live in the **domain layer**; concrete rulesets (FCI, SRSH, later AKC/KC) are **pure domain modules** in their own package that depend only on the domain core (dependency inversion — the core never references them). Infrastructure only _loads_ the declarative data and _wires_ the policy implementations.

**Versioning:** the `Effective Ruleset` is snapshotted and **versioned onto each Show at setup**, so a Show is judged under the rules in force on its date and is immune to later ruleset edits (e.g. the SRSH title-rule change of 2025-10-01).

## Considered options

- **Fully declarative data + a rule-expression language** — rejected: forces inventing a near-Turing-complete DSL for award-eligibility and title-earning; high complexity, poor testability.
- **Behavioural policy / Strategy entirely in code** — rejected: every trivial vocabulary difference (a new class, a renamed grade) would need code; loses the "add a ruleset by authoring data" goal.
- **Data-first hybrid** — chosen: most axes are data (add a ruleset ≈ author data), only ~3 are code; deep, narrow ports; clean DDD fit.

## Consequences

- Adding a **new club that resembles an existing one** is mostly data authoring; a genuinely different scoring model needs only new policy implementations, not core changes.
- **AKC/KC sanity check (passes):** AKC's 7 groups, its class list, and its show types slot in as data; its **points/majors** are computed by an `AwardPolicy` implementation, with **no FCI-CACIB layer** composed (AKC is a standalone base). The **championship title** itself is owner-asserted (not computed), consistent with the titles-are-owner-asserted decision (ADR-0002).
- The domain core has zero references to any club; ruleset modules are independently testable in isolation.
- Cost: a small amount of composition/resolution machinery, and a versioning/snapshot mechanism on Shows.
