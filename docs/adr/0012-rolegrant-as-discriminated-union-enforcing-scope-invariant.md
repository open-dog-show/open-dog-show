# RoleGrant as a discriminated union enforcing the role/scope invariant

> **Amended 2026-08-26:** the `TenantScope` type was renamed to `ClubScope`
> (carrying `clubId: ClubId`) as part of the `tenant` → `club` rename (issue
> #116). The role/scope invariant is unchanged: `ShowSecretary` is granted at
> `ClubScope`; `Judge`/`PlatformAdministrator` at `PlatformScope`.

`RoleGrant` is modelled as a discriminated union rather than a flat interface, so that the role/scope pairing is checked at compile time: `ShowSecretary` can only be granted at `ClubScope`, and `Judge`/`PlatformAdministrator` can only be granted at `PlatformScope`. An object literal that pairs the wrong role with the wrong scope is a type error.

The flat-interface alternative (`role: DomainRole; scope: RoleScope`) is structurally simpler at the call site, but it allows nonsense combinations — a `Judge` grant at Club scope, or a `ShowSecretary` grant at platform scope — that would silently pass through `grantRole` and `hasRoleGrant`, producing incorrect ACL decisions. The discriminated union makes impossible states unrepresentable and eliminates a whole class of authorisation bugs without any runtime cost.
