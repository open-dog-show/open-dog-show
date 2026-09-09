// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Ownership classification of a past fact.
 *
 * Declares which data-ownership scope produced the event:
 * - `'club'`      — the fact belongs to a kennel-club Club.
 * - `'exhibitor'` — the fact belongs to an individual exhibitor.
 * - `'platform'`  — the fact is platform-wide and has no single owner.
 *
 * This is **not** the same as `TransactionScope`, which describes the
 * database-transaction context.  An event's `EventScope` is immutable once
 * recorded; `TransactionScope` is ephemeral and lives only for the duration
 * of one unit-of-work.
 *
 * Modelled as a class-based **variant value object** (ADR-0023): a discriminated
 * union of data-less value-object classes, each carrying only a `kind` tag and
 * constructed solely through its `of` factory (V2/V3). The wire/DB form is the
 * `kind` string, rehydrated by {@link asEventScope} at the boundary.
 */
export class ClubEventScope {
    readonly kind = 'club' as const;

    private constructor() {}

    static of(): ClubEventScope {
        return new ClubEventScope();
    }

    equals(other: ClubEventScope): boolean {
        return this.kind === other.kind;
    }
}

export class ExhibitorEventScope {
    readonly kind = 'exhibitor' as const;

    private constructor() {}

    static of(): ExhibitorEventScope {
        return new ExhibitorEventScope();
    }

    equals(other: ExhibitorEventScope): boolean {
        return this.kind === other.kind;
    }
}

export class PlatformEventScope {
    readonly kind = 'platform' as const;

    private constructor() {}

    static of(): PlatformEventScope {
        return new PlatformEventScope();
    }

    equals(other: PlatformEventScope): boolean {
        return this.kind === other.kind;
    }
}

export type EventScope = ClubEventScope | ExhibitorEventScope | PlatformEventScope;

/**
 * Value equality for {@link EventScope} — every variant is data-less, so two
 * scopes are equal iff their `kind` tags match (V3). Narrows on `kind` and
 * delegates to the variant's {@link EventScope#equals} for shape parity with
 * the other variant value objects.
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
 * Casts a raw wire/DB string to an {@link EventScope}, **validating** it is one
 * of the three known scopes. Mirrors `asEventType`: a corrupt `scope` from a
 * database row or JSON must be rejected at the boundary rather than propagated
 * as a typed event.
 *
 * @throws {TypeError} when `value` is not a known EventScope.
 */
export function asEventScope(value: string): EventScope {
    switch (value) {
        case 'club':
            return ClubEventScope.of();
        case 'exhibitor':
            return ExhibitorEventScope.of();
        case 'platform':
            return PlatformEventScope.of();
        default:
            throw new TypeError(
                `Invalid EventScope '${value}': expected 'club', 'exhibitor', or 'platform'.`,
            );
    }
}
