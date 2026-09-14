// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    User,
    UserSuspendedError,
    InvalidProviderClaimsError,
} from '../../domain/model/user/user.js';
// Re-exported so callers (`from './authenticate.js'`) still see the errors; the
// canonical definitions live with the `User` aggregate, next to the rules they
// signal.
export { UserSuspendedError, InvalidProviderClaimsError } from '../../domain/model/user/user.js';
import { DuplicateExternalSubjectError } from '../../domain/model/user/user-repository.js';
import type {
    IdentityProvider,
    ProviderClaims,
} from '../../domain/model/user/identity-provider.js';
import type { UserIdGenerator } from '../../domain/model/user/user-id-generator.js';
import { PlatformTransactionScope, type Result } from '../../../Shared/index.js';
import type { IamUnitOfWork, IamUnitOfWorkContext } from '../ports/unit-of-work.js';

/** Inputs to {@link AuthenticateHandler.execute}. */
export interface AuthenticateCommand {
    /** Opaque bearer token to resolve against the identity provider. */
    readonly token: string;
}

/** Primitive view of the authenticated User (B4). */
export interface AuthenticateResponse {
    readonly userId: string;
    readonly displayName: string;
    readonly email: string;
}

/** Expected domain failures {@link AuthenticateHandler.execute} reports on its output (E1). */
export type AuthenticateError = UserSuspendedError | InvalidProviderClaimsError;

/**
 * Use case: authenticate the bearer of a token against the identity provider,
 * registering a new platform account on first login or logging in an
 * existing one, inside one IAM unit of work scoped `platform` (Users are
 * platform data, ADR-0005).
 *
 * - **First login** (unknown `sub`): a new `Active` user is `User.register`ed
 *   from the provider claims and persisted via `UserRepository.add`, which
 *   throws `DuplicateExternalSubjectError` if a concurrent request already
 *   won the insert for the same `sub`. That race is caught **once**: the
 *   handler re-reads the winning account and continues through
 *   `User.prototype.logIn`, exactly like a returning login — so two
 *   simultaneous first logins for one `sub` cannot mint two platform
 *   accounts, and the loser still gets a properly logged-in response rather
 *   than an error.
 * - **Returning login** (known `sub`): `User.prototype.logIn` throws
 *   {@link UserSuspendedError} for a `Suspended` account (before any write),
 *   otherwise refreshes `displayName`/`email` from the latest claims; the
 *   result is persisted via `UserRepository.update`, which throws
 *   `ConcurrentModificationError` if the account changed between this read
 *   and this write (e.g. an admin suspended it concurrently) — a technical
 *   fault that propagates rather than silently overwriting the concurrent
 *   change.
 * - **Invalid provider claims**: `User.register` rejects a blank `sub` or
 *   `email`; this is returned as
 *   `{ ok: false, error: InvalidProviderClaimsError }`, so no account is
 *   created.
 *
 * **Technical faults are not part of the `Result`** (E4): an invalid/unknown
 * token is rejected by {@link IdentityProvider.resolve}, whose port contract
 * throws — that fault propagates out of `execute` to the outermost boundary
 * handler, which maps it to an authentication failure alongside the `Result`
 * error cases. One outer `try`/`catch` maps the two expected domain failures
 * to the `Result`; everything else (including `ConcurrentModificationError`)
 * rethrows.
 *
 * The platform `UserId` is intentionally distinct from the provider `sub`
 * (ADR-0013); a new id is minted by the {@link UserIdGenerator} on first login.
 */
export class AuthenticateHandler {
    constructor(
        private readonly unitOfWork: IamUnitOfWork,
        private readonly identityProvider: IdentityProvider,
        private readonly userIdGenerator: UserIdGenerator,
    ) {}

    async execute(
        command: AuthenticateCommand,
    ): Promise<Result<AuthenticateResponse, AuthenticateError>> {
        const claims = await this.identityProvider.resolve(command.token);
        try {
            return await this.unitOfWork.run(PlatformTransactionScope.of(), (ctx) =>
                this.registerOrLogIn(ctx, claims),
            );
        } catch (error) {
            if (
                error instanceof UserSuspendedError ||
                error instanceof InvalidProviderClaimsError
            ) {
                return { ok: false, error };
            }
            throw error;
        }
    }

    /**
     * First login (unknown `sub`): registers a new user. Returning login
     * (known `sub`): logs the existing user in. See the class doc for the
     * first-login-race handling.
     */
    private async registerOrLogIn(
        ctx: IamUnitOfWorkContext,
        claims: ProviderClaims,
    ): Promise<Result<AuthenticateResponse, AuthenticateError>> {
        const existing = await ctx.users.findByExternalSubject(claims.sub);
        if (existing !== undefined) {
            return this.logInAndRespond(ctx, existing, claims);
        }

        const candidate = User.register(this.userIdGenerator.generate(), claims.sub, claims);
        try {
            await ctx.users.add(candidate);
            return { ok: true, value: toResponse(candidate) };
        } catch (error) {
            if (!(error instanceof DuplicateExternalSubjectError)) throw error;
            // First-login race: a concurrent request already won the insert
            // for this sub. Re-read the winner and continue through the
            // normal returning-login path exactly once — no further retry.
            const winner = await ctx.users.findByExternalSubject(claims.sub);
            if (winner === undefined) throw error;
            return this.logInAndRespond(ctx, winner, claims);
        }
    }

    /** Logs an existing `user` in, persists the result, and maps it to the ok `Result`. */
    private async logInAndRespond(
        ctx: IamUnitOfWorkContext,
        user: User,
        claims: ProviderClaims,
    ): Promise<Result<AuthenticateResponse, AuthenticateError>> {
        const loggedIn = user.logIn(claims);
        await ctx.users.update(loggedIn);
        return { ok: true, value: toResponse(loggedIn) };
    }
}

function toResponse(user: User): AuthenticateResponse {
    return { userId: user.id, displayName: user.displayName, email: user.email };
}
