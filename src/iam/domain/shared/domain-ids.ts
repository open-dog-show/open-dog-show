// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@ods/iam`'s own domain identifiers.
 *
 * Per ADR-0013, the Identity & Access context owns its concrete platform-account
 * identifier (`UserId`) in its own domain layer rather than importing it from the
 * shared kernel. The kernel, in turn, owns the context-neutral `PrincipalId` it
 * needs for RLS plumbing. This module is the identity owner's identifier
 * definition — the seam the migrate step switches IAM's existing `UserId` imports
 * onto (those still import `UserId` from `@ods/kernel` during the expand step).
 */

declare const __brand: unique symbol;

/**
 * Compile-time brand helper — local to `@ods/iam` so this context's branded ids
 * are owned here, not in the kernel. A branded type is structurally identical to
 * `T` at runtime but is treated as a distinct type by the TypeScript compiler,
 * preventing accidental substitution of one id kind for another.
 */
type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Branded string that uniquely identifies a platform user account.
 *
 * This is `@ods/iam`'s own account identifier (ADR-0013). It is intentionally a
 * distinct brand from the kernel's `PrincipalId`: a `UserId` names the concrete
 * account, while a `PrincipalId` names the abstract transaction actor used only
 * for RLS plumbing. The `User → PrincipalId` cast happens at the composition
 * root (when it exists); today only the sample integration tests construct a
 * `TransactionScope`.
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Casts a raw string to a {@link UserId}.
 *
 * This is the only safe boundary-crossing point where an untyped string (e.g.
 * from a database row or an external identity-provider claim) becomes a typed
 * `UserId`. Prefer calling it at the outermost layer (repository, ACL adapter)
 * so the rest of the domain works exclusively with typed ids. It is a plain
 * cast — no validation.
 */
export const asUserId = (id: string): UserId => id as UserId;
