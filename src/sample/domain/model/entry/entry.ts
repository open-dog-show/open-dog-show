// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId, TransactionScope } from '../../../../Shared/index.js';
import type { EntryId, ShowId } from '../../shared/domain-ids.js';

export interface Entry {
    readonly id: EntryId;
    readonly clubId: ClubId;
    readonly principalId: PrincipalId;
    readonly showId: ShowId;
    readonly dogName: string;
}

/**
 * Thrown when {@link createEntry} receives a {@link TransactionScope} whose kind
 * it cannot accept. `received` names the offending scope kind, so callers can
 * discriminate this failure by type.
 */
export class InvalidTransactionScopeError extends Error {
    readonly received: TransactionScope['kind'];

    constructor(received: TransactionScope['kind'], message: string) {
        super(message);
        this.name = 'InvalidTransactionScopeError';
        this.received = received;
    }
}

/**
 * Inputs to {@link createEntry} that are not derivable from the transaction
 * scope — the Entry's own id, the Show it is submitted to, and the dog's call
 * name. The owning Club and acting principal come from the `club` scope.
 */
export interface EntryInput {
    readonly id: EntryId;
    readonly showId: ShowId;
    readonly dogName: string;
}

/**
 * Construct an {@link Entry} from the input and the transaction scope.
 *
 * An Entry is Club-owned, so only a `club` scope (which carries both the owning
 * `ClubId` and the acting `PrincipalId`) is accepted; an `exhibitor` or
 * `platform` scope has no Club to attribute the Entry to and throws
 * {@link InvalidTransactionScopeError}. Keeping this rule in the aggregate
 * factory means the "Entry is Club-owned" invariant cannot be bypassed by an
 * application layer that builds an `Entry` literal directly.
 */
export function createEntry(scope: TransactionScope, input: EntryInput): Entry {
    if (scope.kind !== 'club') {
        throw new InvalidTransactionScopeError(
            scope.kind,
            `An Entry is Club-owned; received a '${scope.kind}' scope with no Club to attribute it to`,
        );
    }
    return {
        id: input.id,
        clubId: scope.clubId,
        principalId: scope.principalId,
        showId: input.showId,
        dogName: input.dogName,
    };
}
