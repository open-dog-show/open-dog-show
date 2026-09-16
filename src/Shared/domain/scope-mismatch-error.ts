// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from './transaction-scope.js';

/**
 * Thrown by `requireClubScope` / `requireActor` (`require-scope.ts`) when the
 * acting `TransactionScope` is not one the use case can work with (ADR-0026).
 *
 * A wrong scope kind is a technical fault, not a business outcome the caller
 * branches on: a delivery route knows statically which scope it builds, and
 * ADR-0011 rejects a wrong identity before the domain is reached. Hence this
 * extends `Error` rather than `DomainError` — it is not part of the `Result`
 * channel (E1).
 */
export class ScopeMismatchError extends Error {
    readonly expected: string;
    readonly received: TransactionScope['kind'];

    constructor(expected: string, received: TransactionScope['kind']) {
        super(`Expected a '${expected}' TransactionScope but received a '${received}' scope`);
        this.name = 'ScopeMismatchError';
        this.expected = expected;
        this.received = received;
    }
}
