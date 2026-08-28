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

/**
 * Factory for a new `Active` user.
 *
 * A user is created on first login from the identity-provider claims: the
 * platform `UserId` (distinct from the provider `sub`, ADR-0013), the opaque
 * external subject, and the initial display name and email. The account always
 * starts `Active`.
 */
export function createUser(
    id: UserId,
    externalSubject: string,
    displayName: string,
    email: string,
): User {
    return { id, externalSubject, displayName, email, status: 'Active' };
}

/**
 * Returns a copy of `user` with refreshed `displayName` and `email`.
 *
 * The stable identity (id, external subject) and account status are preserved —
 * refreshing a profile never changes account status (a `Suspended` user stays
 * `Suspended`). {@link authenticate} guards against refreshing a suspended
 * account before calling this.
 */
export function refreshUserProfile(user: User, displayName: string, email: string): User {
    return { ...user, displayName, email };
}
