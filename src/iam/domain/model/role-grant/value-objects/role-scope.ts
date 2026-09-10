// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId } from '../../../../../Shared/index.js';

/**
 * Where a {@link RoleGrant} applies — a specific Club (carrying the owning
 * `ClubId`) or the whole platform.
 *
 * A single value object with multiple named factories (the harness "same shape,
 * multiple factories" rule): both variants share the shape `{ kind, clubId }`,
 * differing only in whether `clubId` is present — the platform variant is the
 * absence of a Club, not a different field set, so this is **not** a discriminated
 * union of per-variant classes (ADR-0023 amendment). Constructed solely through
 * {@link RoleScope.club} / {@link RoleScope.platform} (V2/V3); the role↔scope
 * correlation itself is enforced on the {@link RoleGrant} aggregate (ADR-0024).
 */
export class RoleScope {
    readonly kind: 'club' | 'platform';

    readonly clubId: ClubId | undefined;

    private constructor(kind: 'club' | 'platform', clubId: ClubId | undefined) {
        this.kind = kind;
        this.clubId = clubId;
    }

    static club(clubId: ClubId): RoleScope {
        return new RoleScope('club', clubId);
    }

    static platform(): RoleScope {
        return new RoleScope('platform', undefined);
    }

    equals(other: RoleScope): boolean {
        return this.kind === other.kind && this.clubId === other.clubId;
    }
}
