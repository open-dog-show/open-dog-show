// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId, EmailAddress, ExternalSubject } from '../../shared/domain-ids.js';
import { asEmailAddress, asExternalSubject } from '../../shared/domain-ids.js';
import { DomainError } from '../../../../Shared/domain/domain-error.js';

export type UserStatus = 'Active' | 'Suspended';

/**
 * The refreshable profile facts an identity provider asserts about a user.
 *
 * The `(displayName, email)` pair travels together from the provider into the
 * `User` aggregate; bundling it as one type removes the positional-swap risk of
 * passing two bare strings to {@link User.create} / {@link User.prototype.refreshProfile}.
 */
export interface UserProfileFacts {
    readonly displayName: string;
    readonly email: string;
}

/** Already-canonical attribute values for {@link User.rehydrate} (the storage-load path). */
export interface UserAttributes {
    readonly id: UserId;
    readonly displayName: string;
    readonly email: EmailAddress;
    readonly status: UserStatus;
    readonly externalSubject: ExternalSubject;
}

/**
 * Thrown by {@link User.create} and {@link User.rehydrate} when a required
 * provider claim is blank (empty or whitespace-only after its normalization).
 *
 * `field` discriminates which required claim was rejected — `sub` (the
 * external subject) or `email`. {@link authenticate} catches this and returns
 * it as an `AuthenticateResult` failure (alongside {@link UserSuspendedError}),
 * so callers branch on the `Result` rather than handling a rejected promise;
 * the composition root / API boundary maps that failure to an auth response. A blank
 * `displayName` is *not* rejected (it is cosmetic) and never produces this
 * error.
 */
export class InvalidProviderClaimsError extends DomainError {
    readonly field: 'sub' | 'email';

    constructor(field: 'sub' | 'email') {
        super(`Invalid identity-provider claims: '${field}' is blank`, { field });
        this.field = field;
    }
}

/**
 * Thrown by {@link User.prototype.suspend} / {@link User.prototype.reactivate}
 * when the user is already in the target status, so no transition is
 * possible. `from` names the user's current status and `to` the requested
 * status, so callers can discriminate this failure by type (unlike a bare
 * `Error`).
 */
export class InvalidUserStatusTransitionError extends DomainError {
    readonly from: UserStatus;
    readonly to: UserStatus;

    constructor(user: User, to: UserStatus) {
        super(`User ${user.id} is already ${user.status}; cannot transition to ${to}`, {
            userId: user.id,
            from: user.status,
            to,
        });
        this.from = user.status;
        this.to = to;
    }
}

/**
 * Thrown when an authentication attempt targets a `Suspended` user. The
 * aggregate owns this rule (and the error) so the suspension check lives with
 * the `User` invariant rather than being re-implemented by each caller.
 */
export class UserSuspendedError extends DomainError {
    readonly userId: UserId;

    constructor(user: User) {
        super(`User ${user.id} is Suspended and cannot authenticate`, { userId: user.id });
        this.userId = user.id;
    }
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
 * A platform account for an authenticated person, identified by an opaque
 * external identity-provider subject claim.
 *
 * Modelled as a class aggregate (ADR-0022): the account's status transitions
 * ({@link suspend}/{@link reactivate}) and the authentication guard
 * ({@link assertCanAuthenticate}) are instance methods rather than
 * module-level functions operating on a structural type, so the aggregate is
 * not anemic. A private `#brand` field makes the class **nominal** (mirrors
 * {@link RoleGrant}) so a bare `{ id, displayName, ... }` object literal (the
 * TS structural-literal leak a `private constructor` cannot block on its own)
 * is not assignable to `User`. The constructor also runs a **guard** — a blank
 * `sub`/`email` throws {@link InvalidProviderClaimsError} — on every
 * construction path (mirrors {@link RoleGrant}'s correlated-field guard,
 * ADR-0024): a blank subject or email is never a valid `User`, at creation or
 * on reload, so {@link rehydrate} enforces it too rather than trusting a
 * storage row unconditionally. {@link create} and {@link rehydrate} are the
 * two construction paths (new vs. reconstituted from storage); `create`
 * additionally canonicalizes raw claims (ADR-0015) before the guard runs,
 * while `rehydrate` does not re-canonicalize — it assumes a stored row's
 * values are already in canonical form, only re-checking that they're present.
 */
export class User {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `User` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly id: UserId;

    readonly displayName: string;

    readonly email: EmailAddress;

    readonly status: UserStatus;

    /** Opaque external identity provider subject claim — used only by the ACL adapter. */
    readonly externalSubject: ExternalSubject;

    private constructor(attributes: UserAttributes) {
        if (isBlank(attributes.externalSubject)) {
            throw new InvalidProviderClaimsError('sub');
        }
        if (isBlank(attributes.email)) {
            throw new InvalidProviderClaimsError('email');
        }
        this.id = attributes.id;
        this.displayName = attributes.displayName;
        this.email = attributes.email;
        this.status = attributes.status;
        this.externalSubject = attributes.externalSubject;
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
     * whitespace-only after normalization) is rejected by the constructor's guard
     * with {@link InvalidProviderClaimsError}; a blank `displayName` is allowed
     * (it is cosmetic and some providers omit it).
     */
    static create(id: UserId, externalSubject: string, profile: UserProfileFacts): User {
        return new User({
            id,
            displayName: normalizeDisplayName(profile.displayName),
            email: asEmailAddress(normalizeEmail(profile.email)),
            status: 'Active',
            externalSubject: asExternalSubject(externalSubject),
        });
    }

    /**
     * Rehydrate a {@link User} from already-canonical storage columns — the
     * repository-load path. Unlike {@link create}, this does not re-run claim
     * *canonicalization* (trim/lowercase): the row is assumed to already be in
     * canonical form (it was produced by `create`/`refreshProfile` on a prior
     * write). It does still run the constructor's blank-`sub`/`email` guard —
     * a corrupt or pre-ADR-0015 row is rejected rather than rehydrated into an
     * invalid aggregate (defense-in-depth, mirrors {@link RoleGrant.rehydrate}).
     *
     * Takes a single {@link UserAttributes} object rather than positional
     * arguments (unlike {@link RoleGrant.rehydrate}'s 3 positional params) —
     * `User` carries five attributes, past the point where callers can
     * reliably track positional order.
     */
    static rehydrate(attributes: UserAttributes): User {
        return new User(attributes);
    }

    /**
     * Returns a copy of this user with the given fields overridden — `undefined`
     * in `patch` means "keep the existing value" — all others carried over
     * unchanged.
     */
    private copyWith(patch: {
        displayName?: UserAttributes['displayName'] | undefined;
        email?: UserAttributes['email'] | undefined;
        status?: UserAttributes['status'] | undefined;
    }): User {
        return new User({
            id: this.id,
            displayName: patch.displayName ?? this.displayName,
            email: patch.email ?? this.email,
            status: patch.status ?? this.status,
            externalSubject: this.externalSubject,
        });
    }

    /** Returns a Suspended copy of this user. Throws {@link InvalidUserStatusTransitionError} if already Suspended. */
    suspend(): User {
        if (this.status === 'Suspended') {
            throw new InvalidUserStatusTransitionError(this, 'Suspended');
        }
        return this.copyWith({ status: 'Suspended' });
    }

    /** Returns an Active copy of this user. Throws {@link InvalidUserStatusTransitionError} if already Active. */
    reactivate(): User {
        if (this.status === 'Active') {
            throw new InvalidUserStatusTransitionError(this, 'Active');
        }
        return this.copyWith({ status: 'Active' });
    }

    /**
     * Asserts that this user may authenticate — throws {@link UserSuspendedError}
     * when `Suspended`, no-op for `Active`. The single source of the suspension
     * rule, so the application-layer `authenticate` flow (and any future caller)
     * reuses one check instead of re-implementing it.
     */
    assertCanAuthenticate(): void {
        if (this.status === 'Suspended') {
            throw new UserSuspendedError(this);
        }
    }

    /**
     * Returns a copy of this user with refreshed `displayName` and `email`.
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
    refreshProfile(profile: UserProfileFacts): User {
        const incomingDisplayName = normalizeDisplayName(profile.displayName);
        const incomingEmail = normalizeEmail(profile.email);
        return this.copyWith({
            displayName: isBlank(incomingDisplayName) ? undefined : incomingDisplayName,
            email: isBlank(incomingEmail) ? undefined : asEmailAddress(incomingEmail),
        });
    }
}
