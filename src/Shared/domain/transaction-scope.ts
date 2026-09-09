// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId } from './domain-ids.js';

/**
 * The identity carried into a unit-of-work transaction.
 *
 * Distinct from {@link EventScope}: `EventScope` describes _who owns a fact_
 * (written on the domain event / outbox row); `TransactionScope` describes
 * _who is acting_ so that the correct RLS session variables can be set.
 * See ADR-0005 — "Two distinct concepts, not one." Per ADR-0013 the actor is a
 * context-neutral `PrincipalId` (the kernel's RLS-plumbing type), not IAM's
 * `UserId`; the SQL wire name `app.user_id` is unchanged.
 *
 * Modelled as a class-based **variant value object** (ADR-0023): a discriminated
 * union of value-object classes, each with a private constructor plus a
 * validating static factory, so a `TransactionScope` can only be built through
 * its `of` factory (V2/V3). The variants carry only already-validated branded
 * ids, so the factories are pass-throughs that fix the `kind` tag.
 *
 * - `club` — a Club admin acting on behalf of a Club: both `clubId` and `principalId` are set.
 * - `exhibitor` — a dog owner acting cross-Club: only `principalId` is set.
 * - `platform` — a platform operator acting globally: no Club or user isolation.
 */
export class ClubTransactionScope {
    readonly kind = 'club' as const;

    private constructor(
        readonly clubId: ClubId,
        readonly principalId: PrincipalId,
    ) {}

    static of(clubId: ClubId, principalId: PrincipalId): ClubTransactionScope {
        return new ClubTransactionScope(clubId, principalId);
    }

    equals(other: ClubTransactionScope): boolean {
        return this.clubId === other.clubId && this.principalId === other.principalId;
    }
}

export class ExhibitorTransactionScope {
    readonly kind = 'exhibitor' as const;

    private constructor(readonly principalId: PrincipalId) {}

    static of(principalId: PrincipalId): ExhibitorTransactionScope {
        return new ExhibitorTransactionScope(principalId);
    }

    equals(other: ExhibitorTransactionScope): boolean {
        return this.principalId === other.principalId;
    }
}

export class PlatformTransactionScope {
    readonly kind = 'platform' as const;

    private constructor() {}

    static of(): PlatformTransactionScope {
        return new PlatformTransactionScope();
    }

    equals(other: PlatformTransactionScope): boolean {
        return this.kind === other.kind;
    }
}

export type TransactionScope =
    ClubTransactionScope | ExhibitorTransactionScope | PlatformTransactionScope;

/**
 * Value equality for {@link TransactionScope} — narrows both sides on `kind`
 * before delegating to the variant's {@link TransactionScope#equals} (V3).
 * Two scopes are equal iff they are the same variant and that variant's data
 * match; a `platform` scope equals every other `platform` scope.
 */
export function transactionScopesEqual(a: TransactionScope, b: TransactionScope): boolean {
    switch (a.kind) {
        case 'club':
            return b.kind === 'club' && a.equals(b);
        case 'exhibitor':
            return b.kind === 'exhibitor' && a.equals(b);
        case 'platform':
            return b.kind === 'platform' && a.equals(b);
    }
}
