# RoleGrant as a discriminated union enforcing the role/scope invariant

`RoleGrant` is modelled as a discriminated union rather than a flat interface, so that the role/scope pairing is checked at compile time: `ShowSecretary` can only be granted at `TenantScope`, and `Judge`/`PlatformAdministrator` can only be granted at `PlatformScope`. An object literal that pairs the wrong role with the wrong scope is a type error.

The flat-interface alternative (`role: DomainRole; scope: RoleScope`) is structurally simpler at the call site, but it allows nonsense combinations — a `Judge` grant at tenant scope, or a `ShowSecretary` grant at platform scope — that would silently pass through `grantRole` and `hasRoleGrant`, producing incorrect ACL decisions. The discriminated union makes impossible states unrepresentable and eliminates a whole class of authorisation bugs without any runtime cost.
