// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from './domain-ids.js';

export type UserStatus = 'Active' | 'Suspended';

export interface User {
    readonly id: UserId;
    readonly displayName: string;
    readonly email: string;
    readonly status: UserStatus;
    /** Opaque external identity provider subject claim — used only by the ACL adapter. */
    readonly externalSubject: string;
}

/** Returns a Suspended copy of an Active user. Throws if the user is already Suspended. */
export function suspendUser(user: User): User {
    if (user.status === 'Suspended') {
        throw new Error(`User ${user.id} is already Suspended`);
    }
    return { ...user, status: 'Suspended' };
}

/** Returns an Active copy of a Suspended user. Throws if the user is already Active. */
export function reactivateUser(user: User): User {
    if (user.status === 'Active') {
        throw new Error(`User ${user.id} is already Active`);
    }
    return { ...user, status: 'Active' };
}
