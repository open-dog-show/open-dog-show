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

/**
 * Thrown by {@link createUser} when a required provider claim is blank
 * (empty or whitespace-only after its normalization).
 *
 * `field` discriminates which required claim was rejected — `sub` (the
 * external subject) or `email`. {@link authenticate} does not catch this; it
 * propagates exactly as {@link UserSuspendedError} does, so the composition
 * root / API boundary can map it to an authentication failure. A blank
 * `displayName` is *not* rejected (it is cosmetic) and never produces this
 * error.
 */
export class InvalidProviderClaimsError extends Error {
    readonly field: 'sub' | 'email';

    constructor(field: 'sub' | 'email') {
        super(`Invalid identity-provider claims: '${field}' is blank`);
        this.name = 'InvalidProviderClaimsError';
        this.field = field;
    }
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
 * Canonicalize an email claim: trim, then lowercase. Returns the empty string
 * for a blank (empty or whitespace-only) input — the caller decides whether a
 * blank email is allowed (creation rejects it; refresh keeps the existing value).
 */
function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/** Canonicalize a displayName claim: trim only (names are case-meaningful). */
function normalizeDisplayName(displayName: string): string {
    return displayName.trim();
}

function isBlank(value: string): boolean {
    return value.trim() === '';
}

/**
 * Factory for a new `Active` user.
 *
 * A user is created on first login from the identity-provider claims: the
 * platform `UserId` (distinct from the provider `sub`, ADR-0013), the opaque
 * external subject, and the initial display name and email. The account always
 * starts `Active`.
 *
 * The aggregate canonicalizes what it is given (ADR-0015): `email` is trimmed
 * and lowercased and `displayName` is trimmed, while `externalSubject` (the
 * provider `sub`) is stored **verbatim** — it is an opaque, exact-match
 * correlation key and must not be reshaped. A blank `sub` or `email` (empty or
 * whitespace-only after normalization) is rejected with
 * {@link InvalidProviderClaimsError}; a blank `displayName` is allowed (it is
 * cosmetic and some providers omit it). This makes the contract hold for every
 * `User` produced by `createUser` / `refreshUserProfile`; other construction
 * paths (repository rehydration, test fixtures) must preserve the invariant
 * themselves, since `User` is structural and the factories cannot enforce it
 * transitively.
 */
export function createUser(
    id: UserId,
    externalSubject: string,
    displayName: string,
    email: string,
): User {
    if (isBlank(externalSubject)) {
        throw new InvalidProviderClaimsError('sub');
    }
    const normalizedEmail = normalizeEmail(email);
    if (isBlank(normalizedEmail)) {
        throw new InvalidProviderClaimsError('email');
    }
    return {
        id,
        externalSubject,
        displayName: normalizeDisplayName(displayName),
        email: normalizedEmail,
        status: 'Active',
    };
}

/**
 * Returns a copy of `user` with refreshed `displayName` and `email`.
 *
 * The stable identity (id, external subject) and account status are preserved —
 * refreshing a profile never changes account status (a `Suspended` user stays
 * `Suspended`). {@link authenticate} guards against refreshing a suspended
 * account before calling this.
 *
 * The incoming claims are canonicalized (ADR-0015): `email` is trimmed and
 * lowercased and `displayName` is trimmed. A **keep-existing guard** then
 * applies: when a normalized incoming value is blank (empty or
 * whitespace-only), the existing stored value is preserved instead of being
 * overwritten — a transient provider omission must not lock a returning user
 * out or destroy a known-good value. The guard suppresses only a
 * blank→overwrite; a refresh can still change a non-empty value to a different
 * non-empty value.
 */
export function refreshUserProfile(user: User, displayName: string, email: string): User {
    const incomingDisplayName = normalizeDisplayName(displayName);
    const incomingEmail = normalizeEmail(email);
    return {
        ...user,
        displayName: isBlank(incomingDisplayName) ? user.displayName : incomingDisplayName,
        email: isBlank(incomingEmail) ? user.email : incomingEmail,
    };
}
