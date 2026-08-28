---
status: accepted
---

# IAM provider-claim canonicalization lives in the `User` aggregate

> Resolves the open design question in issue #127 ("Normalize and validate
> identity-provider claims in `@ods/iam` authenticate"). Clarifies, but does
> not amend, [ADR-0011](0011-context-specific-identity-ports-for-iam-acl.md):
> an aggregate enforcing its own structural invariants is not the
> provider-vocabulary leak ADR-0011 forbids.

## Context

`CONTEXT.md` defines a **User** as carrying _"a normalized display name and
email sourced from the provider and refreshed on each login."_ The
`authenticate` operation that landed in #80 stores the provider's claims
**verbatim**: `createUser` and `refreshUserProfile` perform no normalization or
validation, `asUserId` is a deliberately no-validation plain cast, and a
refresh overwrites a stored field even with an empty claim. This is a
documented-vs-implemented gap — and a real hazard: an empty `sub` would create
an account with `externalSubject: ''`, and any later empty-`sub` login would
collide with it via `findByExternalSubject('')`.

The question is _where_ canonicalization (normalization + validation) should
live, given [ADR-0011](0011-context-specific-identity-ports-for-iam-acl.md)'s
rule that the generic Identity & Access context stays behind the
`IdentityProvider` anti-corruption port and that the domain layer must not leak
provider vocabulary.

## Decision

Canonicalization is an invariant of the **`User` aggregate**, enforced in
`createUser` and `refreshUserProfile`. The `IdentityProvider` port and the
`ProviderClaims` interface stay a **raw-claims seam** — `resolve(token)`
returns whatever the provider sent; the aggregate canonicalizes what it is
given. These operations guarantee their own output is canonical; other
construction paths (a future database rehydration, a test fixture, a second
provider adapter) must preserve the invariant themselves — `User` is a
structural interface, so the factories cannot enforce it transitively.

### Canonicalization rules

- **`sub` → `externalSubject`**: store **verbatim** (it is an opaque,
  exact-match correlation key — lowercasing or trimming could corrupt it).
  **Reject when blank** (empty or whitespace-only) at creation — an account
  cannot exist with `externalSubject: ''`. `externalSubject` is never
  refreshed (it is the stable identity; `refreshUserProfile` preserves it).
- **`email`**: **trim + lowercase**. **Reject when blank** at creation. At
  refresh, a blank incoming email **keeps the existing stored value** (the
  keep-existing guard) rather than throwing or blanking — a transient provider
  omission must not lock a returning user out or destroy a known-good value.
- **`displayName`**: **trim** only (names are case-meaningful). **Allowed
  blank** at creation (a display name is cosmetic and some providers omit it).
  At refresh, the same keep-existing guard applies: a blank incoming
  `displayName` keeps the existing value.

A blank value is "empty or whitespace-only _after_ its normalization" (trim for
`displayName`; trim+lowercase for `email`; raw for `sub`). A refresh can still
_change_ a non-empty value to a _different_ non-empty value; only
blank→overwrite is suppressed.

### Error handling

`createUser` throws a single domain error, `InvalidProviderClaimsError`, with a
`field: 'sub' | 'email'` discriminant, on a blank required field. `authenticate`
does **not** catch it — it propagates exactly as `UserSuspendedError` does
today; a future composition root / API boundary will map it to an
authentication failure (issue #127 scopes that mapping to "when it exists"). The refresh keep-existing guard never throws (it silently keeps the
stored value). `asUserId` is **untouched** (its no-validation plain cast is a
deliberate, pinned contract for the _platform_ `UserId` — empty must survive
verbatim so PostgreSQL rejects an invalid UUID rather than silently nulling it;
the empty-`sub` concern is `externalSubject`, now guarded by `createUser`).

### Scope boundary

This decision is blank/whitespace rejection only. It does **not** validate
email _format_ (RFC shape) — the provider is trusted for that. Format
validation is a separate, larger scope that #127 does not ask for.

## Why this does not violate ADR-0011

ADR-0011 forbids the domain layer from _naming a concrete provider_ (OIDC
`iss`, SAML, claim jargon) and from reaching past the `IdentityProvider` port.
Trim+lowercase of an **email** and trim of a **displayName** are shapings of
domain attributes, not provider vocabulary — they leak no provider concept.
Rejecting a blank `externalSubject` is a structural invariant of the `User`
aggregate (an account with no correlation key is not a valid account), which is
precisely the kind of rule an aggregate should enforce regardless of which
provider supplied the claim. The `IdentityProvider` port remains the
anti-corruption boundary to the concrete provider; the aggregate owns the
canonical form of its own data.

## Considered options

- **At the `IdentityProvider` boundary (a conforming implementation, or a
  normalizing wrapper, returns already-canonical `ProviderClaims`); the
  aggregate stays a thin data holder.** Rejected: the "normalized" contract is
  a property of the `User`, not of one ingestion path. If canonicalization
  lived only at the port, a `User` built any other way (database rehydration,
  a test fixture, a second adapter that forgets to normalize) could be
  un-normalized, silently violating the contract. It also couples the port
  contract to canonicalization, so every future implementation and
  `FakeIdentityProvider` must re-implement the same rules.
- **Both — validate at the boundary, normalize in the aggregate.** Rejected:
  two rejection sites that must stay consistent as the code evolves, for no
  payoff over a single aggregate check — the throw already surfaces at
  `createUser`, before any save. The drift risk outweighs the defense-in-depth.
- **Reject blank `displayName` at creation (require it).** Rejected: a display
  name is cosmetic and some providers omit it; the issue's acceptance criteria
  reject blank `email` but only _trim_ `displayName`. Allowing blank keeps the
  asymmetry intentional.

## Consequences

- `createUser` and `refreshUserProfile` gain normalization + validation; each
  guarantees its own output is canonical. Other construction paths
  (rehydration, fixtures) must preserve the invariant themselves — `User` is
  structural, so the factories cannot enforce it transitively.
- `authenticate` is unchanged in shape (still a thin coordinator); it acquires
  one new propagated error type (`InvalidProviderClaimsError`).
- The `IdentityProvider` port / `ProviderClaims` interface are unchanged; only
  their docstrings are updated to state that `ProviderClaims` are raw and that
  the `User` aggregate canonicalizes them.
- `asUserId` is unchanged; the `domain-ids.test.ts` `asUserId('')` pin stays.
- A future second `IdentityProvider` implementation need only resolve tokens
  to claims — it is not responsible for canonicalization, so it cannot
  silently break the invariant by forgetting a rule.
- ADR-0011 needs no amendment: this ADR clarifies its scope (aggregate
  invariants ≠ provider-vocabulary leak), it does not contradict it.
