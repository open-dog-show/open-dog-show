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
 * Modelled as a class-based value object with **multiple named factories**
 * (ADR-0023, as amended by ADR-0024): every variant is data-less (only a
 * `kind` tag), so the variants share one shape and one class —
 * {@link EventScope.club} / {@link EventScope.exhibitor} /
 * {@link EventScope.platform} — rather than a discriminated union of separate
 * classes (the harness "same shape, multiple factories" rule). The wire/DB
 * form is the `kind` string, rehydrated by {@link asEventScope} at the
 * boundary.
 */
export class EventScope {
    readonly kind: 'club' | 'exhibitor' | 'platform';

    private constructor(kind: 'club' | 'exhibitor' | 'platform') {
        this.kind = kind;
    }

    /** The fact belongs to a kennel-club Club. */
    static club(): EventScope {
        return new EventScope('club');
    }

    /** The fact belongs to an individual exhibitor. */
    static exhibitor(): EventScope {
        return new EventScope('exhibitor');
    }

    /** The fact is platform-wide and has no single owner. */
    static platform(): EventScope {
        return new EventScope('platform');
    }

    /**
     * Value equality — every variant is data-less, so two scopes are equal iff
     * their `kind` tags match (V3).
     */
    equals(other: EventScope): boolean {
        return this.kind === other.kind;
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
            return EventScope.club();
        case 'exhibitor':
            return EventScope.exhibitor();
        case 'platform':
            return EventScope.platform();
        default:
            throw new TypeError(
                `Invalid EventScope '${value}': expected 'club', 'exhibitor', or 'platform'.`,
            );
    }
}
