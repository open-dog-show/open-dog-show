---
status: accepted
---

# Aggregates take typed owner ids; the domain never sees `TransactionScope`

> Decided in #184; implemented by #186 (kernel helpers), #188 (generators) and #189 (IAM).
> Amends the use-case example of [ADR-0014](0014-application-layer-unit-of-work-port.md).
> Refines [ADR-0005](0005-data-ownership-scopes-and-rls-keys.md) and
> [ADR-0011](0011-context-specific-identity-ports-for-iam-acl.md).

## Context

`Entry.submit(scope: TransactionScope, input)` derived the owning `ClubId` and the acting
`PrincipalId` from the RLS transaction scope and threw `InvalidTransactionScopeError` for
any scope other than `club`. The generator copied the same rule into its use case, with a
bare `Error`.

That reads _who is acting_ (ADR-0014: "the scope is who is acting — RLS, not domain data")
as _who owns the data_, and for a hybrid row the two differ. An Exhibitor entering a Dog
into Club A's Show acts under an `exhibitor` scope with no Club. The owning Club comes
from the Show being entered. The old factory made that Entry impossible to create. Only a
Club official could create it, and the row's `user_id` then held the official's id, so the
"readable by the exhibitor who created it" half of the hybrid policy could never match.

## Decision

- **Aggregate factories take branded owner ids**, e.g.
  `Item.create({ id, clubId, createdBy, name })` with `clubId: ClubId` and
  `createdBy: PrincipalId`. Club ownership is a compile-time guarantee, not a runtime scope
  check. A hybrid aggregate takes `clubId` from its input (the owning parent's id) and
  `createdBy` from the actor.
- **No `domain/` file imports `TransactionScope`.** The use case narrows the scope once
  through small kernel helpers (e.g. `requireClubScope`, `requireActor`).
- **A wrong scope kind is a thrown technical fault.** The helpers throw
  `ScopeMismatchError`, which is not a `DomainError`. A delivery route knows statically
  which scope it builds, and ADR-0011 rejects a wrong identity before the domain is
  reached, so no caller branches on this. Business outcomes still return `Result`
  (harness E1).
- **Use cases take the harness shape**: `XxxHandler.execute(command, scope)` in
  `application/<use-case>/`, with `XxxCommand` and a primitive `XxxResponse`. One outer
  `try/catch` maps expected `DomainError`s to the `Result` and rethrows everything else.
  The scope stays a separate argument (ADR-0014).
- **Repository ports are `findById` / `add` / `update`.** `add` is insert-only, so a
  duplicate id fails loudly instead of silently overwriting. Changes go through load →
  mutator → `update`.

## Considered options

- **A context-local owner value object per scope** (e.g. `ClubOwned { clubId, createdBy }`):
  rejected as the same guarantee with an extra type per aggregate, and its natural names
  collide with the glossary's **Owner** / **Ownership**.
- **Keep `TransactionScope` in the aggregate and document it**: rejected. It keeps the
  hybrid bug and pulls RLS plumbing into every domain model.
- **Return a wrong scope as a `DomainError` in every `Result`**: rejected. Callers would
  branch on something they cannot handle (E6).
- **Single upsert `save`**: rejected. It silently overwrote fields on a repeated create and
  left no mutator for change-only rules.

## Consequences

- `InvalidTransactionScopeError` is removed.
- The field name `createdBy` is domain-facing; the Postgres column stays `user_id` (ADR-0005).
- Every generated context shows both failure channels and both write paths (create and
  load-change-update).
