---
status: accepted
---

# Class-aggregate correlated-field invariant: per-role factories + constructor guard (RoleGrant per ADR-0022)

> Records how a class-based aggregate enforces a **correlated-field invariant**
> — where one field's value determines another's type (a role determines its
> scope kind) — now that [ADR-0022](0022-adopt-implementation-patterns-harness-as-leading-standard.md)
> mandates class aggregates and supersedes [ADR-0012](0012-rolegrant-as-discriminated-union-enforcing-scope-invariant.md)'s
> discriminated-union aggregate. The first instance is `RoleGrant` (ticket
> [#173](https://github.com/pslits/open-dog-show/issues/173)); the shape is
> generalised in
> [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md)
> ("Correlated-field invariant" under the Aggregate root section).

## Context

ADR-0012 modelled `RoleGrant` as a discriminated union so the role↔scope pairing
(`ShowSecretary`⇄`ClubScope`; `Judge`/`PlatformAdministrator`⇄`PlatformScope`)
was a **compile-time** type error when wrong — "impossible states unrepresentable."
ADR-0022 adopts the implementation-patterns harness, which sanctions a **single
class aggregate** with runtime invariant enforcement and supersedes the
discriminated-union aggregate (the `EventScope`/`TransactionScope` _value
objects_ stay variant-VO unions per ADR-0023; `RoleScope` is now a single VO
with multiple factories per the ADR-0023 amendment; only the _aggregate_ shape
changes). [#173](https://github.com/pslits/open-dog-show/issues/173) migrates
`RoleGrant` to a class, so the question is: how is the role↔scope pairing
preserved without the discriminated union?

## Decision

`RoleGrant` is a single class with a `private constructor`, **per-role static
factories**, a **`rehydrate` factory** for storage, and a **constructor guard**
that throws on a wrong role↔scope pair:

- `RoleGrant.showSecretary(userId, clubId)` → pairs `'ShowSecretary'` with
  `RoleScope.club(clubId)`.
- `RoleGrant.judge(userId)` / `RoleGrant.platformAdministrator(userId)` → pair
  with `RoleScope.platform()`.
- `RoleGrant.rehydrate(userId, role, scope)` → the storage-load path; runs the
  same guard so a corrupt row is rejected rather than rehydrated into an invalid
  aggregate.
- The private constructor guard (`InvalidRoleScopeError` on a wrong pair) is
  **defence-in-depth**: the per-role factory signatures already make the wrong
  pairing uncallable from domain code (there is no scope parameter where the
  role determines the scope), so the guard protects the `rehydrate` storage-load
  path. A private `#brand` field makes the class nominal, closing the TS
  structural-literal-assignment leak a `private constructor` cannot block on its
  own (a bare `{ userId, role, scope }` literal is not assignable to
  `RoleGrant`), pinned by a compile-time test.

The `RoleGrantKey` lookup value object is a flat `{ role, scope }` shape — no
compile-time role↔scope pairing on the lookup side either (the pairing is
enforced on the `RoleGrant` aggregate). The compile-time "impossible states"
guarantee is replaced by factory signatures (caller-side) + a constructor guard
(internal/rehydrate-side) + a pinning test. This is exactly the trade ADR-0022
names ("the compile-time 'impossible states' guarantee is intentionally traded
for runtime validation").

## Considered options

- **Keep the discriminated-union aggregate (ADR-0012).** Rejected. ADR-0022
  supersedes it; a type alias plus external `grantRole`/`hasRole` functions is
  an anemic aggregate with no behaviour home, and it would be the lone
  non-class aggregate among the #172–#175 migrations.

- **Single class + per-role factories + constructor guard + `rehydrate` (this
  ADR).** Accepted. Factory signatures keep the caller-facing pairing safety
  (the auth-critical part); the constructor guard covers `rehydrate` and the
  literal leak; the class owns behaviour and conforms to the harness; the outbox
  row stays flat (no codec/type-tag registry).

- **Subclass per role (polymorphic methods).** Rejected. Genuine polymorphism,
  but heavier (a class hierarchy needs a `kind`/type-tag rehydration registry in
  the codec — the same concern ADR-0023 flagged for `EventScope`), and ADR-0022
  sanctions a single class aggregate, so a hierarchy would need its own
  deviation ADR. Role-varying behaviour for `RoleGrant` is small enough that
  `switch (this.role)` in methods suffices.

- **Hybrid: a class whose `state` field is the discriminated union.** Rejected
  as over-engineering for this aggregate — it duplicates the pairing check
  (factories + union narrowing) for a small gain in internal compile-time
  safety that the constructor guard already covers at runtime.

## Consequences

- `RoleGrant` is a class that owns its collection behaviours as static methods:
  `RoleGrant.grant` / `RoleGrant.revoke` / `RoleGrant.has` /
  `RoleGrant.assertOwnedBy` operate on `readonly RoleGrant[]` (`has` compares
  against a `RoleGrantKey` directly, no `as RoleGrant` cast — no anemic
  external-function module). `DuplicateRoleGrantError` and
  `RoleGrantOwnerMismatchError` take a `RoleGrant` instance.
- The compile-time "wrong pairing is a type error" guarantee is replaced by:
  per-role factory signatures (caller-side), a constructor guard throwing
  `InvalidRoleScopeError` (internal/`rehydrate`-side), and a pinning test
  covering every role↔scope pair. A future `DomainRole` addition must add a
  factory and extend `isPairingValid` + the test — the compiler no longer
  forces it.
- The outbox/codec shape is unchanged (`RoleGrant` is not serialised to the
  outbox; the future Postgres `RoleGrantRepository` rehydrates via
  `RoleGrant.rehydrate`, which validates).
- The harness records the general pattern (per-role factories + constructor
  guard + `rehydrate`) in its Aggregate root section so the other correlated-
  field aggregates (and any future one) follow the same shape.

## Sources

- [ADR-0022](0022-adopt-implementation-patterns-harness-as-leading-standard.md)
  (class aggregate; compile-time guarantee traded for runtime validation).
- [ADR-0012](0012-rolegrant-as-discriminated-union-enforcing-scope-invariant.md)
  (the superseded discriminated-union aggregate — the historical record of the
  compile-time pairing).
- [ADR-0023](0023-variant-scope-value-objects-as-class-based-variant-value-objects.md)
  (`EventScope`/`TransactionScope` stay variant-VO unions; `RoleScope` is now a
  single VO with multiple factories per the ADR-0023 amendment; only the
  _aggregate_ changes).
- [implementation-patterns/typescript.md](../../.github/skills/implementation-patterns/typescript.md)
  (Aggregate root — "Correlated-field invariant" snippet).
