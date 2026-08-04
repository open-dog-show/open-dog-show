---
status: accepted
---

# Champion Class eligibility checks whether a dog holds _any_ champion certificate, not which specific type

The `ClassEligibilityPolicy` evaluates champion-certificate eligibility as a single boolean — `hasChampionCertificate` on `DogEligibilityProfile` — rather than checking the dog's certificates against a ruleset-owned list of accepted `ChampionCertificateTypeId`s.

## Context

The FCI Champion Class rules accept a specific set of titles: C.I.B., C.I.E., any national beauty champion (≥ 2 CACs, FCI member), any national show champion, and equivalents from FCI partner countries. In principle, the Rulesets context could own a `ChampionCertificateType` vocabulary and the `ClassEligibilityPolicy` could check the dog's asserted certificates against the Effective Ruleset's accepted list.

## Decision

For the initial FCI + SRSH/Belgium scope, the eligibility check is simplified to a boolean. The Entries & Registration context maps a dog's asserted Champion Certificates to `hasChampionCertificate: true` before calling the policy; the policy treats any champion certificate as sufficient.

The type-specific lookup is deferred until cross-NCO entry is in scope — e.g. a dog with only a German champion entering a Belgian show where the SRSH ruleset layer restricts which foreign titles qualify. At that point `ChampionCertificateType` vocabulary and per-ruleset accepted-type lists can be added to the `EffectiveRuleset` and `DogEligibilityProfile` without changing the port's shape beyond adding the new field.

## Considered options

- **Type-based lookup** — `DogEligibilityProfile.heldCertificateTypeIds: ChampionCertificateTypeId[]` checked against `EffectiveRuleset.acceptedChampionCertificateTypeIds` — rejected as premature: for the first two ruleset layers (FCI + SRSH) any holder of a recognised champion certificate qualifies; no ruleset-layer distinction is needed yet.
- **Boolean** — chosen for simplicity; the invariant "a dog must hold at least one champion certificate to enter Champion Class" is fully expressible without a type list.
