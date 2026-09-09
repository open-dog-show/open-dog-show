---
status: accepted
---

# Variant scope value objects as class-based variant value objects (conform to the harness)

> Decides issue #171: the repo's three variant scope value objects —
> `TransactionScope` (`src/Shared/domain/transaction-scope.ts`),
> `RoleScope` / `ClubScope` / `PlatformScope`
> (`src/iam/domain/model/role-grant/role-grant.ts`), and `EventScope`
> (`src/Shared/domain/domain-event.ts`) — **conform** to the implementation-patterns
> harness's **variant value object** shape, per
> [ADR-0022](0022-adopt-implementation-patterns-harness-as-leading-standard.md).
> The harness promotes the variant value object to a first-class object in
> [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md),
> and the three scope types migrate from structural discriminated unions (and,
> for `EventScope`, a closed string-literal union) to class-based variant value
> objects — each variant a class with a private constructor plus a validating
> `of` factory, discriminated by a `readonly kind` tag (V2/V3). This unblocks
> the aggregate-to-class tickets
> [#172](https://github.com/pslits/open-dog-show/issues/172) /
> [#173](https://github.com/pslits/open-dog-show/issues/173) /
> [#174](https://github.com/pslits/open-dog-show/issues/174) /
> [#175](https://github.com/pslits/open-dog-show/issues/175), which now consume
> the scope variants through their factories.

## Decision

Migrate all three variant scope value objects to the harness's class-based
**variant value object** shape — a discriminated union of value-object classes,
each built solely through a validating static factory:

- **`TransactionScope`** = `ClubTransactionScope.of(clubId, principalId)` |
  `ExhibitorTransactionScope.of(principalId)` | `PlatformTransactionScope.of()`.
- **`RoleScope`** = `ClubScope.of(clubId)` | `PlatformScope.of()`.
- **`EventScope`** = `ClubEventScope.of()` | `ExhibitorEventScope.of()` |
  `PlatformEventScope.of()`, with `asEventScope(value: string)` rehydrating the
  class variant from the wire/DB `kind` string at the boundary.

Each variant is a class with a `private constructor` and a static `of` factory,
so construction goes through the factory (V2/V3). Each variant also implements
an `equals(other)` method, and a union-level value-equality helper
(`transactionScopesEqual` / `eventScopesEqual` / `roleScopesEqual`) narrows both
sides on `kind` before delegating to the variant's `equals` — the harness's
value-equality pattern (V3). The variants carry already-validated branded ids
(`ClubId`/`PrincipalId`) or only a `kind` tag, so the factories are pass-throughs
that fix the `kind` discriminator; the data-less variants (`Platform*`,
`EventScope`) compare by `kind` alone.

The wire/DB form of `EventScope` stays the `kind` string (`'club'` | `'exhibitor'`
| `'platform'`): `encodeDomainEvent` flattens `event.scope.kind` to the outbox/
JSON `scope` column, and `asEventScope` rehydrates the class variant from that
string. `TransactionScope`/`RoleScope` are in-memory only (never serialised), so
they need no codec.

The aggregate-to-class tickets (#172–#175) consume these scope variants through
their factories. `RoleGrant`'s discriminated-union _aggregate_ shape is a separate
concern owned by #173 (ADR-0012, superseded by ADR-0022 for the aggregate); this
ADR covers only the `RoleScope` value object `RoleGrant` references, and the
`@ts-expect-error` "ShowSecretary requires ClubScope" compile-time guard still
holds because the class variants are discriminated by `kind`.

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

- `TransactionScope`, `RoleScope`/`ClubScope`/`PlatformScope`, and `EventScope`
  are class-based variant value objects. Every construction site
  (`scopeToRlsKeys`, `with-transaction`, `pg-outbox-writer`, the use cases, and
  the tests) builds a scope through its `of` factory.
- The kernel (`src/Shared/index.ts`) and IAM (`src/iam/index.ts`) barrel exports
  ship the variant classes as values alongside the union types.
- `encodeDomainEvent` and `PgOutboxWriter` serialise `event.scope.kind` (the
  wire string) instead of `event.scope`; `asEventScope` rehydrates the class
  variant at the boundary. The outbox `scope` column and `DomainEventJson.scope`
  stay `text`/`string`.
- `pnpm typecheck` / `lint` / `test` green (425 tests pass; the ADR is
  Prettier-formatted). No database migration — the wire `scope` values are
  unchanged.
- The harness records the conformance in
  [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md)
  (the "Variant value object" section), so the shape is discoverable from the
  leading standard.
