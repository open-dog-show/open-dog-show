---
status: accepted
---

# CollectiveAwardPolicy is a separate port from AwardPolicy

Collective Competitions (Brace/Couple, Breeders' Group, Progeny Group) are validated through a dedicated `CollectiveAwardPolicy` port rather than extending `AwardPolicy` to handle both individual and collective judging.

## Context

`AwardPolicy` answers two questions about a per-sex, breed, group, or show scope: which Award Types may be proposed, and are the proposed assignments valid? Its inputs are `JudgingScopeResults` — a discriminated union of per-class placements and candidate entry lists — and an `EffectiveRuleset`. The whole contract is built around grades, placements, and Award Scope Levels.

Collective Competitions are structurally different: there are no grades, no class placements, and no Award Scope Level hierarchy. The validation asks only whether the group's composition is structurally valid (correct count, correct sex mix for Brace/Couple). When valid, all participants win as a unit — there is no internal ranking.

## Decision

`CollectiveAwardPolicy` is a separate port with a single method, `evaluate(results: CollectiveCompetitionResults): CollectiveAwardResult`. It knows nothing about grades, placements, or Award Types. Its in-memory FCI implementation lives in the `@ods/rulesets/testing` sub-path alongside `FciAwardPolicy`.

## Considered options

- **Extend `AwardPolicy`** with an overloaded method or a new `collective` variant of `JudgingScopeResults` — rejected because `JudgingScopeResults` is built around placements and candidate entries that collective competitions simply don't have. Forcing them into the same union would either bloat the existing variants with optional fields or add a fifth collective variant that the current four scope-level handlers would need to ignore via exhaustive switch.
- **Separate port** — chosen because the domain concepts are disjoint. `AwardPolicy` owns individual class/scope judging; `CollectiveAwardPolicy` owns structural group validation. Neither leaks into the other's contract.
