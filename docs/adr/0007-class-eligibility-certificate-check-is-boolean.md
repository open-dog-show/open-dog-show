---
status: accepted
---

# Class eligibility checks held certificates against the class's required certificates

The `ClassEligibilityPolicy` checks the dog's `heldCertificates` against the
`ClassDefinition.requiredCertificates`: every required `CertificateKind` must be
present in `DogEligibilityProfile.heldCertificates`. The profile carries a set of
held certificate kinds, not a single champion-certificate boolean.

## Context

The FCI Champion Class rules accept a specific set of titles: C.I.B., C.I.E., any
national beauty champion (≥ 2 CACs, FCI member), any national show champion, and
equivalents from FCI partner countries. In principle, the Rulesets context could own
a `ChampionCertificateType` vocabulary and the `ClassEligibilityPolicy` could check
the dog's asserted certificates against the Effective Ruleset's accepted list.

Beyond the champion certificate, FCI classes require other certificates — the Working
Class requires a working certificate, and the Puppy class requires vaccination. A
single `hasChampionCertificate: boolean` cannot express "requires a working
certificate" or "requires vaccination," so the eligibility model carries a
`requiredCertificates: ReadonlyArray<CertificateKind>` list on the `ClassDefinition`
and matches it against `DogEligibilityProfile.heldCertificates: ReadonlyArray<CertificateKind>`.

## Decision

For the initial FCI + SRSH/Belgium scope, certificate eligibility is modelled as a
set membership over a small, closed `CertificateKind` vocabulary
(`ChampionCertificate`, `WorkingCertificate`, `Vaccination`). The Entries &
Registration context maps a dog's asserted certificates to the held set before calling
the policy; the policy checks that every required kind is held. The champion-certificate
check is the slice of this model that corresponds to "a dog must hold at least one
champion certificate to enter Champion Class" — `requiredCertificates: [ChampionCertificate]`.

The type-specific lookup is deferred until cross-NCO entry is in scope — e.g. a dog
with only a German champion entering a Belgian show where the SRSH ruleset layer
restricts which foreign titles qualify. At that point `ChampionCertificateType`
vocabulary and per-ruleset accepted-type lists can be added to the `EffectiveRuleset`
and `DogEligibilityProfile` without changing the port's shape beyond adding the new
field; the held-vs-required set check generalises to that lookup unchanged.

> **Amendment (issue #133, 2026-08-28).** The original ADR prescribed a single
> `hasChampionCertificate: boolean` on `DogEligibilityProfile`. The implementation
> generalised this to `heldCertificates: ReadonlyArray<CertificateKind>` matched
> against `ClassDefinition.requiredCertificates`, because the FCI ruleset data
> already requires non-champion certificates (working certificate for the Working
> Class, vaccination for the Puppy class) that the boolean could not express. This is
> an intentional generalisation, not drift; the ADR is amended here to match the
> code so the doc and the code agree.

## Considered options

- **Type-based lookup** — `DogEligibilityProfile.heldCertificateTypeIds: ChampionCertificateTypeId[]` checked against `EffectiveRuleset.acceptedChampionCertificateTypeIds` — rejected as premature: for the first two ruleset layers (FCI + SRSH) any holder of a recognised champion certificate qualifies; no ruleset-layer distinction is needed yet.
- **Single champion boolean** — `hasChampionCertificate: boolean` — the original wording of this ADR. Sufficient for the Champion Class invariant alone, but it cannot express the working-certificate and vaccination requirements that the FCI ruleset data already carries, so the held-vs-required set membership was adopted instead.
- **Held-vs-required set membership** — `DogEligibilityProfile.heldCertificates: ReadonlyArray<CertificateKind>` checked against `ClassDefinition.requiredCertificates` — chosen; a small closed `CertificateKind` vocabulary expresses every certificate requirement the current ruleset layers need, and generalises to the deferred type-specific lookup without reshaping the port.
