// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { PlatformTransactionScope, type ClubId } from '../../../Shared/index.js';
import { asUserId } from '../../domain/shared/domain-ids.js';
import type { DomainRole } from '../../domain/model/role-grant/role-grant.js';
import type { IamUnitOfWork } from '../ports/unit-of-work.js';

/**
 * The published, read-only view of a User and their role grants (ADR-0028).
 *
 * All primitives (B4) — `userId` is a plain string (not IAM's branded
 * `UserId`, which never leaves the context), and `clubId` is present only
 * for a Club-scoped role grant (`ShowSecretary`); absent for a
 * platform-scoped one (`Judge`/`PlatformAdministrator`), modelled as an
 * optional property rather than an explicit `undefined` member (N4).
 */
export interface IdentitySnapshot {
    readonly userId: string;
    readonly active: boolean;
    readonly roleGrants: ReadonlyArray<{ readonly role: DomainRole; readonly clubId?: string }>;
}

/**
 * IAM's published contract for downstream ACL adapters (ADR-0028): a
 * context-specific identity port translates a `User` and its role grants
 * into that context's own identity type, and `IdentityQuery` is the one
 * read model it queries to do so — in-process, so a role revocation takes
 * effect on the next call rather than after an event-propagation delay. (No
 * transactional `IamUnitOfWork` implementation exists yet, #189 — once one
 * does, this call inherits whatever isolation guarantee it gives a read.)
 *
 * Runs inside the same `IamUnitOfWork` port the write side uses (scoped
 * `platform`, ADR-0005) rather than a separate read connection, so there is
 * exactly one IAM persistence dependency to wire at the composition root.
 */
export class IdentityQuery {
    constructor(private readonly unitOfWork: IamUnitOfWork) {}

    async findIdentity(userId: string): Promise<IdentitySnapshot | undefined> {
        return this.unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            const id = asUserId(userId);
            const user = await ctx.users.findById(id);
            if (user === undefined) return undefined;
            const roleGrants = await ctx.userRoleGrants.findByUser(id);
            return {
                userId: user.id,
                active: user.isActive(),
                roleGrants: roleGrants.grants.map((grant) =>
                    toRoleGrantView(grant.role, grant.scope.clubId),
                ),
            };
        });
    }
}

function toRoleGrantView(
    role: DomainRole,
    clubId: ClubId | undefined,
): { role: DomainRole; clubId?: string } {
    return clubId === undefined ? { role } : { role, clubId };
}
