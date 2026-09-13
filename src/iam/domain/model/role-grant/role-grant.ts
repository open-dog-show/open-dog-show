// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DomainError, type ClubId } from '../../../../Shared/index.js';
import { RoleScope } from './value-objects/role-scope.js';

export type DomainRole = 'ShowSecretary' | 'Judge' | 'PlatformAdministrator';

/**
 * A named {@link DomainRole} paired with the {@link RoleScope} it applies in —
 * Club-scoped (`ShowSecretary`) or platform-global (`Judge` /
 * `PlatformAdministrator`).
 *
 * Modelled as a **value object** (ADR-0026/#189): unlike its predecessor, it
 * carries no `userId` — a `RoleGrant` is intended to be constructed only via
 * `UserRoleGrants`'s grant methods and to live only inside the aggregate it
 * belongs to (itself identified by `UserId`), so repeating the id on every
 * entry was redundant state the aggregate could drift out of sync with. That
 * intent is not structurally enforced — the per-role factories stay public
 * static methods so `UserRoleGrants.rehydrate`/tests can construct a
 * `RoleGrant` directly — it is a naming/usage convention, not a compile-time
 * guarantee. The role↔scope correlation, by contrast, *is* enforced by
 * **per-role factories** (the wrong pairing is uncallable from
 * domain code — there is no scope parameter where the role determines the
 * scope) plus a **constructor guard** that throws {@link InvalidRoleScopeError}
 * on a wrong pair — defence-in-depth for the {@link RoleGrant.rehydrate}
 * storage-load path. A private `#brand` field makes the class **nominal** so a
 * bare `{ role, scope }` object literal (the TS structural-literal leak
 * a `private constructor` cannot block on its own) is not assignable to
 * `RoleGrant` — the type is closed against unvalidated construction (mirrors
 * `LocalDate`). The compile-time "impossible states" guarantee of the
 * superseded discriminated-union aggregate (ADR-0012) is traded for runtime
 * validation, pinned by a test.
 *
 * Granting, revoking, and duplicate/lookup checks are owned by the
 * `UserRoleGrants` aggregate root, not by this value object (ADR-0026: no
 * IAM domain error holds an aggregate reference, and a bare
 * `RoleGrant[]` no longer carries the collection behaviours a prior revision
 * hung off static methods here).
 */
export class RoleGrant {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `RoleGrant` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly role: DomainRole;

    readonly scope: RoleScope;

    private constructor(role: DomainRole, scope: RoleScope) {
        if (!isPairingValid(role, scope)) {
            throw new InvalidRoleScopeError(role, scope);
        }
        this.role = role;
        this.scope = scope;
    }

    static showSecretary(clubId: ClubId): RoleGrant {
        return new RoleGrant('ShowSecretary', RoleScope.club(clubId));
    }

    static judge(): RoleGrant {
        return new RoleGrant('Judge', RoleScope.platform());
    }

    static platformAdministrator(): RoleGrant {
        return new RoleGrant('PlatformAdministrator', RoleScope.platform());
    }

    /**
     * Rehydrate a {@link RoleGrant} from storage. Runs the same role↔scope guard
     * as the per-role factories so a corrupt row is rejected rather than
     * rehydrated into an invalid aggregate (V2).
     */
    static rehydrate(role: DomainRole, scope: RoleScope): RoleGrant {
        return new RoleGrant(role, scope);
    }

    /** Value equality: same role and an equal scope. */
    equals(other: RoleGrant): boolean {
        return this.role === other.role && this.scope.equals(other.scope);
    }
}

/**
 * Thrown when a {@link RoleGrant} is constructed/rehydrated with a role↔scope
 * pairing the domain does not allow (`ShowSecretary`⇄club scope with a
 * `clubId`; `Judge`/`PlatformAdministrator`⇄platform scope with no `clubId`).
 * The `clubId` context records whether a club id was missing (a club scope
 * without one) or extra (a platform scope carrying one) so the failure is
 * diagnosable.
 */
export class InvalidRoleScopeError extends DomainError {
    readonly role: DomainRole;

    readonly scopeKind: RoleScope['kind'];

    readonly clubId: ClubId | undefined;

    constructor(role: DomainRole, scope: RoleScope) {
        super(
            `RoleGrant role '${role}' is invalid for a '${scope.kind}' scope (clubId ${scope.clubId === undefined ? 'missing' : 'present'})`,
            { role, scopeKind: scope.kind, clubId: scope.clubId },
        );
        this.role = role;
        this.scopeKind = scope.kind;
        this.clubId = scope.clubId;
    }
}

/**
 * The role↔scope correlation rule (ADR-0012, restated as a runtime check per
 * ADR-0024). Checks both the `kind` pairing and the `clubId` presence/absence
 * it implies: a club scope must carry a `clubId`, a platform scope must not.
 */
function isPairingValid(role: DomainRole, scope: RoleScope): boolean {
    if (role === 'ShowSecretary') return scope.kind === 'club' && scope.clubId !== undefined;
    return scope.kind === 'platform' && scope.clubId === undefined;
}
