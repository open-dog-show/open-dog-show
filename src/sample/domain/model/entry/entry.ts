// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainError,
    type ClubId,
    type PrincipalId,
    type TransactionScope,
} from '../../../../Shared/index.js';
import type { EntryId, ShowId } from '../../shared/domain-ids.js';

/**
 * An Entry — a dog submitted to a Show by an exhibitor, owned by a Club.
 *
 * Modelled as a class aggregate (ADR-0022/0024): the "an Entry is Club-owned"
 * invariant is enforced by a validating factory — {@link Entry.submit} — that
 * derives the owning `ClubId` and acting `PrincipalId` from a `club`
 * {@link TransactionScope} and rejects any other scope kind
 * ({@link InvalidTransactionScopeError}). A private `#brand` field makes the
 * class **nominal** so a bare `{ id, clubId, … }` object literal (the TS
 * structural-literal leak a `private constructor` cannot block on its own) is
 * not assignable to `Entry` — the type is closed against unvalidated
 * construction (mirrors `RoleGrant` / `LocalDate`). Storage load goes through
 * {@link Entry.rehydrate}, the one other construction path.
 */
export class Entry {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `Entry` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly id: EntryId;
    readonly clubId: ClubId;
    readonly principalId: PrincipalId;
    readonly showId: ShowId;
    readonly dogName: string;

    private constructor(
        id: EntryId,
        clubId: ClubId,
        principalId: PrincipalId,
        showId: ShowId,
        dogName: string,
    ) {
        this.id = id;
        this.clubId = clubId;
        this.principalId = principalId;
        this.showId = showId;
        this.dogName = dogName;
    }

    /**
     * Submit an {@link Entry} under `scope`.
     *
     * An Entry is Club-owned, so only a `club` scope (which carries both the
     * owning `ClubId` and the acting `PrincipalId`) is accepted; an `exhibitor`
     * or `platform` scope has no Club to attribute the Entry to and throws
     * {@link InvalidTransactionScopeError}. Keeping this rule in the aggregate
     * factory means the "Entry is Club-owned" invariant cannot be bypassed by
     * an application layer that builds an `Entry` literal directly.
     */
    static submit(scope: TransactionScope, input: EntryInput): Entry {
        if (scope.kind !== 'club') {
            throw new InvalidTransactionScopeError(
                scope.kind,
                `An Entry is Club-owned; received a '${scope.kind}' scope with no Club to attribute it to`,
            );
        }
        return new Entry(input.id, scope.clubId, scope.principalId, input.showId, input.dogName);
    }

    /**
     * Rehydrates an {@link Entry} from storage. The owning `ClubId` and acting
     * `PrincipalId` are supplied directly (a stored row carries them as
     * columns), so — unlike {@link Entry.submit} — no `TransactionScope` is
     * consumed. The `#brand` field forces repositories onto this path instead
     * of building an `Entry` literal (V2).
     */
    static rehydrate(input: {
        readonly id: EntryId;
        readonly clubId: ClubId;
        readonly principalId: PrincipalId;
        readonly showId: ShowId;
        readonly dogName: string;
    }): Entry {
        return new Entry(input.id, input.clubId, input.principalId, input.showId, input.dogName);
    }
}

/**
 * Thrown when {@link Entry.submit} receives a {@link TransactionScope} whose
 * kind it cannot accept. `received` names the offending scope kind, so callers
 * can discriminate this failure by type.
 */
export class InvalidTransactionScopeError extends DomainError {
    readonly received: TransactionScope['kind'];

    constructor(received: TransactionScope['kind'], message: string) {
        super(message, { received });
        this.received = received;
    }
}

/**
 * Inputs to {@link Entry.submit} that are not derivable from the transaction
 * scope — the Entry's own id, the Show it is submitted to, and the dog's call
 * name. The owning Club and acting principal come from the `club` scope.
 */
export interface EntryInput {
    readonly id: EntryId;
    readonly showId: ShowId;
    readonly dogName: string;
}
