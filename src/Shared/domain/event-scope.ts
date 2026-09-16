// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { asClubId, asPrincipalId, type ClubId, type PrincipalId } from './domain-ids.js';

/**
 * Ownership classification of a past fact, carrying the owning id.
 *
 * Declares which data-ownership scope produced the event, and — unlike a
 * `TransactionScope` — records *who owns the fact*, not who was acting when
 * it happened:
 * - `club`      — the fact belongs to an organising Club (`clubId`).
 * - `exhibitor` — the fact belongs to an individual exhibitor (`principalId`).
 * - `platform`  — the fact is platform-wide and has no single owner.
 *
 * This is **not** the same as `TransactionScope`, which describes the
 * database-transaction context.  An event's `EventScope` is immutable once
 * recorded; `TransactionScope` is ephemeral and lives only for the duration
 * of one unit-of-work. A hybrid aggregate's events are always `club(clubId)`
 * — ADR-0005 gives each row one ownership scope and a wider read predicate —
 * even when the acting `TransactionScope` was `exhibitor` (ADR-0027).
 *
 * Modelled as a class-based **variant value object** (ADR-0023, as amended by
 * ADR-0027): the variants carry different fields (`clubId` vs `principalId`
 * vs none), so each is its own class — {@link ClubEventScope} /
 * {@link ExhibitorEventScope} / {@link PlatformEventScope} — discriminated by
 * `kind`, mirroring `TransactionScope`. The wire/DB form is the `kind` string
 * plus the flattened `clubId`/`principalId` columns, rehydrated by
 * {@link asEventScope} at the boundary.
 */
export class ClubEventScope {
    readonly kind = 'club' as const;

    private constructor(readonly clubId: ClubId) {}

    static of(clubId: ClubId): ClubEventScope {
        return new ClubEventScope(clubId);
    }

    equals(other: ClubEventScope): boolean {
        return this.clubId === other.clubId;
    }
}

export class ExhibitorEventScope {
    readonly kind = 'exhibitor' as const;

    private constructor(readonly principalId: PrincipalId) {}

    static of(principalId: PrincipalId): ExhibitorEventScope {
        return new ExhibitorEventScope(principalId);
    }

    equals(other: ExhibitorEventScope): boolean {
        return this.principalId === other.principalId;
    }
}

export class PlatformEventScope {
    readonly kind = 'platform' as const;

    // eslint-disable-next-line @typescript-eslint/no-empty-function -- private nominal constructor (ADR-0023); `of()` is the only way to construct this singleton-shaped variant.
    private constructor() {}

    static of(): PlatformEventScope {
        return new PlatformEventScope();
    }

    equals(other: PlatformEventScope): boolean {
        // Mirrors the other variants' equals(other) shape; always true since
        // PlatformEventScope carries no data beyond `kind`.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- always true by construction (no fields beyond `kind`), kept for shape parity with the other variants
        return this.kind === other.kind;
    }
}

export type EventScope = ClubEventScope | ExhibitorEventScope | PlatformEventScope;

/**
 * Value equality for {@link EventScope} — narrows both sides on `kind` before
 * delegating to the variant's `equals` (V3). Two scopes are equal iff they are
 * the same variant and that variant's data match.
 */
export function eventScopesEqual(a: EventScope, b: EventScope): boolean {
    switch (a.kind) {
        case 'club':
            return b.kind === 'club' && a.equals(b);
        case 'exhibitor':
            return b.kind === 'exhibitor' && a.equals(b);
        case 'platform':
            return b.kind === 'platform' && a.equals(b);
    }
}

/**
 * Rehydrates an {@link EventScope} from its wire/DB form — the `kind` string
 * plus the flattened `clubId`/`principalId` columns — **validating** the
 * combination: `club` needs `clubId` only, `exhibitor` needs `principalId`
 * only, and `platform` needs neither. Mirrors `asEventType`: a corrupt row
 * must be rejected at the boundary rather than propagated as a typed event.
 *
 * @throws {TypeError} when `kind` is unknown, or the id combination does not
 *   match the expected shape for `kind`.
 */
function toClubEventScope(clubId: string | null, principalId: string | null): ClubEventScope {
    if (clubId === null || principalId !== null) {
        throw new TypeError(
            `Invalid EventScope 'club': expected a clubId and no principalId (got clubId=${String(clubId)}, principalId=${String(principalId)}).`,
        );
    }
    return ClubEventScope.of(asClubId(clubId));
}

function toExhibitorEventScope(
    clubId: string | null,
    principalId: string | null,
): ExhibitorEventScope {
    if (principalId === null || clubId !== null) {
        throw new TypeError(
            `Invalid EventScope 'exhibitor': expected a principalId and no clubId (got clubId=${String(clubId)}, principalId=${String(principalId)}).`,
        );
    }
    return ExhibitorEventScope.of(asPrincipalId(principalId));
}

function toPlatformEventScope(
    clubId: string | null,
    principalId: string | null,
): PlatformEventScope {
    if (clubId !== null || principalId !== null) {
        throw new TypeError(
            `Invalid EventScope 'platform': expected neither clubId nor principalId (got clubId=${String(clubId)}, principalId=${String(principalId)}).`,
        );
    }
    return PlatformEventScope.of();
}

/**
 * `kind` is an untrusted wire string (a raw `outbox.scope` column value),
 * not a value already narrowed to `EventScope`'s closed union — so the
 * `default` case below is reachable input validation, not an exhaustiveness
 * gap. It deliberately does not use the kernel's shared `assertNever`:
 * `assertNever` proves a `switch` over an already-`never`-narrowed type is
 * unreachable at compile time (see `owner-columns.ts`'s `scopeToOwnerColumns`
 * for that shape); here the compiler cannot narrow a bare `string`; a raw
 * `TypeError` is the correct tool for rejecting a bad wire value.
 */
export function asEventScope(
    kind: string,
    clubId: string | null,
    principalId: string | null,
): EventScope {
    switch (kind) {
        case 'club':
            return toClubEventScope(clubId, principalId);
        case 'exhibitor':
            return toExhibitorEventScope(clubId, principalId);
        case 'platform':
            return toPlatformEventScope(clubId, principalId);
        default:
            throw new TypeError(
                `Invalid EventScope '${kind}': expected 'club', 'exhibitor', or 'platform'.`,
            );
    }
}
