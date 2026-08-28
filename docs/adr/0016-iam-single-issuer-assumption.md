---
status: accepted
---

# Defer multi-issuer correlation; pin the single-issuer assumption for `externalSubject`

> Resolves issue #128. Clarifies, but does not amend,
> [ADR-0011](0011-context-specific-identity-ports-for-iam-acl.md): a composite
> `externalSubject` can be assembled **behind** the `IdentityProvider`
> anti-corruption port, keeping provider vocabulary (`iss`) out of the domain.
> Relates to [ADR-0015](0015-iam-claim-canonicalization-in-user-aggregate.md),
> which treats `externalSubject` as an opaque, verbatim correlation key.

## Context

`@ods/iam` correlates a platform `User` across logins by `externalSubject`,
which is the raw provider `sub` (`authenticate` →
`UserRepository.findByExternalSubject(claims.sub)`; `User.externalSubject`
stores `sub` verbatim, ADR-0015). OIDC/SAML `sub` is only **unique within an
issuer**. The model assumes a single, globally-stable `sub` — i.e. exactly one
configured issuer — but that assumption is **implicit**: nothing states it, and
nothing would alert a contributor who configures a second provider. The hazard
is real: the same person across two issuers has two different `sub`s (split
identity → two accounts); two different people with colliding `sub`s across
issuers would silently refresh into one account (merge/hijack).

No concrete `IdentityProvider` adapter or `User` persistence exists yet (only
`FakeIdentityProvider`), so multi-issuer is purely theoretical at present.

## Decision

Defer multi-issuer correlation. Pin the single-issuer assumption as an
explicit, documented invariant of the Identity & Access context:

- The platform operates against **exactly one configured identity provider**,
  and `externalSubject` (the provider `sub`) is treated as **globally stable**
  across all logins.
- The assumption is stated in the domain-layer docstrings (`IdentityProvider`,
  `ProviderClaims`, `authenticate`) and **pinned by a test** that asserts
  correlation is purely on the raw `sub` with no issuer qualification — so a
  future multi-issuer change must update that test deliberately rather than slip
  in silently.
- Multi-issuer correlation (a composite `externalSubject`, e.g. `iss|sub`) is
  **not** built now. When a second provider is actually configured, this ADR is
  revisited.

If/when the composite is adopted, it is assembled **behind the
`IdentityProvider` anti-corruption port** (in the adapter, infrastructure) so
`ProviderClaims.sub` remains an opaque string and the domain never sees `iss`
as a concept. This preserves ADR-0011: the issuer is absorbed by the
anti-corruption layer, not surfaced in the domain.

## Considered options

- **Build the composite `externalSubject` (`iss|sub`) now, with
  `ProviderClaims` carrying an `iss` field.** Rejected: surfaces provider
  vocabulary (`iss`) in the domain layer, against ADR-0011; and multi-issuer is
  YAGNI with no real provider adapter or persistence yet — the cost is paid
  before any need exists.
- **Build the composite now but assemble it behind the `IdentityProvider`
  port** (so `ProviderClaims.sub` is already the composite and the domain never
  sees `iss`). Rejected for now on YAGNI grounds: with no concrete adapter or
  persistence there is nothing to compose against and no migration path to
  design yet. The _design_ is recorded here so the eventual build is
  unconstrained and ADR-0011-clean.
- **Document the single-issuer assumption without a test pin.** Rejected:
  documentation alone drifts; a failing test forces a future multi-issuer change
  to confront the assumption loudly.

## Consequences

- A future second identity provider is a **deliberate, test-breaking change**:
  the pinned correlation test fails, forcing the contributor to this ADR and to
  the behind-port composite design before merging.
- `ProviderClaims` gains no `iss` field now; the domain layer names no
  provider/issuer concept (ADR-0011 preserved).
- When the composite is eventually built, the migration must also consider the
  future Postgres unique constraint on `externalSubject` (no `User` persistence
  exists yet) — recorded here, not built.
- `CONTEXT.md`'s `User` entry states the single-issuer assumption as part of
  what "the identity provider's stable subject identifier" means.
