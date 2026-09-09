// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId } from '../../../../../Shared/index.js';

/**
 * Where a {@link RoleGrant} applies — a Club (carrying the owning `ClubId`) or
 * the whole platform. Modelled as a class-based **variant value object**
 * (ADR-0023): a discriminated union of value-object classes, each with an
 * `of` factory as its construction path (V2/V3). The role/scope correlation is still
 * enforced at compile time by the {@link RoleGrant} discriminated union
 * (ADR-0012, superseded by ADR-0022 only for the _aggregate_ shape — the
 * scope value object stays a variant VO per ADR-0023).
 */
export class ClubScope {
    readonly kind = 'club' as const;

    private constructor(readonly clubId: ClubId) {}

    static of(clubId: ClubId): ClubScope {
        return new ClubScope(clubId);
    }

    equals(other: ClubScope): boolean {
        return this.clubId === other.clubId;
    }
}

export class PlatformScope {
    readonly kind = 'platform' as const;

    private constructor() {}

    static of(): PlatformScope {
        return new PlatformScope();
    }

    equals(other: PlatformScope): boolean {
        return this.kind === other.kind;
    }
}

export type RoleScope = ClubScope | PlatformScope;

/**
 * Value equality for {@link RoleScope} — narrows both sides on `kind` before
 * delegating to the variant's {@link RoleScope#equals} (V3). Two Club scopes
 * are equal iff their `ClubId`s match; any two `PlatformScope`s are equal.
 */
export function roleScopesEqual(a: RoleScope, b: RoleScope): boolean {
    switch (a.kind) {
        case 'club':
            return b.kind === 'club' && a.equals(b);
        case 'platform':
            return b.kind === 'platform' && a.equals(b);
    }
}
