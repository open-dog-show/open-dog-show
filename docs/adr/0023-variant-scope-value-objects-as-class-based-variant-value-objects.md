---
status: accepted
---

# Variant scope value objects as class-based variant value objects (conform to the harness)

> Decides issue #171: the repo's three variant scope value objects —
> `TransactionScope` (`src/Shared/domain/transaction-scope.ts`),
> `RoleScope` (`src/iam/domain/model/role-grant/value-objects/role-scope.ts`), and
> `EventScope` (`src/Shared/domain/event-scope.ts`) — **conform** to the
> implementation-patterns harness's value-object shapes, per
> [ADR-0022](0022-adopt-implementation-patterns-harness-as-leading-standard.md).
> The harness promotes the variant value object to a first-class object in
> [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md).
> Per the ADR-0024 amendment below, `TransactionScope` migrates from a structural
> discriminated union to a class-based **variant value object** (a discriminated
> union of value-object classes, each with a private constructor plus a validating
> `of` factory, discriminated by a `readonly kind` tag — V2/V3); `RoleScope` and
> `EventScope` each migrate to a **single value-object class with multiple named
> factories** (the harness "same shape, multiple factories" rule), because their
> variants share one shape. This unblocks the aggregate-to-class tickets
> [#172](https://github.com/pslits/open-dog-show/issues/172) /
> [#173](https://github.com/pslits/open-dog-show/issues/173) /
> [#174](https://github.com/pslits/open-dog-show/issues/174) /
> [#175](https://github.com/pslits/open-dog-show/issues/175), which now consume
> the scope variants through their factories.

> **Amended by [ADR-0024](0024-class-aggregate-correlated-field-invariant-per-role-factories.md)
> (#173):** `RoleScope` is no longer a variant-VO union. Its variants differ only
> in whether `clubId` is present (the platform variant is the _absence_ of a Club,
> not a different field set), so the harness "same shape, multiple factories" rule
> applies — `RoleScope` is one value-object class with `club(clubId)` / `platform()`
> factories and an optional `clubId`, not `ClubScope | PlatformScope`.
> `ClubScope`/`PlatformScope`/`roleScopesEqual` are removed; `RoleScope.equals`
> replaces `roleScopesEqual`.
>
> **Amended (EventScope, #173):** `EventScope` is likewise no longer a
> variant-VO union. All three variants are data-less (only a `kind` tag), so
> they share one shape and one class — `EventScope.club()` /
> `EventScope.exhibitor()` / `EventScope.platform()` — per the harness "same
> shape, multiple factories" rule, not
> `ClubEventScope | ExhibitorEventScope | PlatformEventScope`.
> `ClubEventScope`/`ExhibitorEventScope`/`PlatformEventScope`/`eventScopesEqual`
> are removed; `EventScope.equals` replaces `eventScopesEqual`. Only
> `TransactionScope` remains a class-based variant value object per this ADR
> (its variants carry different fields — `clubId`+`principalId` vs
> `principalId` vs none — so the "different shape, separate classes" rule
> still applies).

> **Amended 2026-09-11 by [ADR-0027](0027-roots-record-events-unit-of-work-stamps-envelope.md)
> (#184):** `EventScope` carries owner ids again, so the outbox's `club_id`/`user_id`
> can be filled from the event rather than from the acting `TransactionScope`. Its variants
> now differ in fields (`club(clubId)` / `exhibitor(principalId)` / `platform()`), so
> the "different shape, separate classes" rule applies. `EventScope` becomes a class-based
> **variant value object** like `TransactionScope`, reversing the (EventScope, #173)
> amendment above. `RoleScope` is unaffected.
>
> This supersedes the `EventScope` bullet under Decision, the "wire/DB form of `EventScope` stays the `kind`
> string" paragraph, and the matching Consequences bullet. The wire form is `scope` plus the flattened owner
> columns `club_id`/`user_id`, and `DomainEventJson` gains `clubId`/`principalId` (`null` when not applicable).
> `asEventScope(kind, clubId, principalId)` rehydrates the variant and **validates** the combination: `club`
> needs `clubId` only, `exhibitor` needs `principalId` only, and `platform` needs neither. Any other combination
> throws at the boundary.

## Decision

Migrate the variant scope value objects to the harness's class-based value-object
shapes. Per the ADR-0024 amendment above, only `TransactionScope` remains a
**variant value object** (a discriminated union of value-object classes, each
built solely through a validating static factory); `RoleScope` and `EventScope`
are each a **single value-object class with multiple named factories** (the
harness "same shape, multiple factories" rule), because their variants differ
only in whether a field is present (`RoleScope`) or not at all (`EventScope`):

- **`TransactionScope`** = `ClubTransactionScope.of(clubId, principalId)` |
  `ExhibitorTransactionScope.of(principalId)` | `PlatformTransactionScope.of()` —
  the variants carry different fields (`clubId`+`principalId` vs `principalId` vs
  none), so the "different shape, separate classes" rule applies.
- **`RoleScope`** = one class with `RoleScope.club(clubId)` / `RoleScope.platform()`
  and an optional `clubId` (the platform variant is the absence of a Club, not a
  different field set). `ClubScope`/`PlatformScope`/`roleScopesEqual` are removed;
  `RoleScope.equals` replaces `roleScopesEqual`.
- **`EventScope`** = one class with `EventScope.club()` / `EventScope.exhibitor()` /
  `EventScope.platform()` — all three variants are data-less (only a `kind` tag), so
  they share one shape and one class. `ClubEventScope`/`ExhibitorEventScope`/
  `PlatformEventScope`/`eventScopesEqual` are removed; `EventScope.equals` replaces
  `eventScopesEqual`. `asEventScope(value: string)` rehydrates the class variant from
  the wire/DB `kind` string at the boundary.

Each value-object class has a `private constructor` and static factory/factories,
so construction goes through the factory (V2/V3). Each implements an `equals(other)`
method — the harness's value-equality pattern (V3). The variants carry
already-validated branded ids (`ClubId`/`PrincipalId`) or only a `kind` tag, so the
factories are pass-throughs that fix the `kind` discriminator; the data-less
variants (`Platform*`, `EventScope`) compare by `kind` alone.

The wire/DB form of `EventScope` stays the `kind` string (`'club'` | `'exhibitor'`
| `'platform'`): `encodeDomainEvent` flattens `event.scope.kind` to the outbox/
JSON `scope` column, and `asEventScope` rehydrates the class variant from that
string. `TransactionScope`/`RoleScope` are in-memory only (never serialised), so
they need no codec.

The aggregate-to-class tickets (#172–#175) consume these scope variants through
their factories. `RoleGrant`'s aggregate shape is a separate concern owned by #173
(ADR-0012, superseded by ADR-0022 for the aggregate; ADR-0024 records the
class-aggregate decision); this ADR covers only the scope value objects
`RoleGrant` references.

## Considered options

- **Conform to the harness class-based variant value object (this ADR).**
  Accepted. ADR-0022's default direction is "reconcile toward the harness"; the
  harness already sanctions a variant value object (discriminated union of class
  value objects). Migrating the three scope types makes them consistent with
  every other value object the harness owns and gives the codec/RLS/aggregates a
  single construction path.

- **Keep as structural discriminated unions / string enum (deliberate-deviation
  ADR).** Rejected. The variants' data are already-validated branded ids or none,
  so a class wrapper is ceremony with no per-variant invariant to enforce — but
  ADR-0022 prefers conformance over a deviation unless a deviation ADR earns its
  keep, and uniformity with the harness outweighs the small ceremony here. The
  `EventScope` string enum is rehydrated by `asEventScope` either way, so the
  class conversion adds a thin `kind`-tag wrapper without a codec rehydration
  registry (the wire form stays the `kind` string).

## Consequences

- `TransactionScope` is a class-based variant value object
  (`ClubTransactionScope`/`ExhibitorTransactionScope`/`PlatformTransactionScope`);
  `RoleScope` and `EventScope` are each a single value-object class with multiple
  named factories per the ADR-0024 amendment. Every construction site
  (`scopeToRlsKeys`, `with-transaction`, `pg-outbox-writer`, the use cases, and
  the tests) builds a scope through its factory/factories.
- The kernel (`src/Shared/index.ts`) and IAM (`src/iam/index.ts`) barrel exports
  ship the value-object classes as values alongside the union/lookup types.
- `encodeDomainEvent` and `PgOutboxWriter` serialise `event.scope.kind` (the
  wire string) instead of `event.scope`; `asEventScope` rehydrates the class
  variant at the boundary. The outbox `scope` column and `DomainEventJson.scope`
  stay `text`/`string`.
- `pnpm typecheck` / `lint` / `test` green. No database migration — the wire
  `scope` values are unchanged.
- The harness records the conformance in
  [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md)
  (the "Variant value object" and "Same shape, multiple factories" sections), so
  the shape is discoverable from the leading standard.
