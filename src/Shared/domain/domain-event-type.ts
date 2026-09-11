// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Brand } from './brand.js';

/**
 * Branded string naming a domain-event type, in `<context>.<PascalName>`
 * form (e.g. `'entries.EntrySubmitted'`).
 *
 * The brand distinguishes an event-type name from an arbitrary string so a
 * context name or aggregate id can never be silently substituted for an
 * event type. Unlike the identifier brands (in `domain-ids.ts`), an
 * `EventType` is **only** obtainable through {@link asEventType}, which
 * validates the format.
 */
export type EventType = Brand<string, 'EventType'>;

/**
 * Matches the {@link EventType} format: a lowercase `<context>` word, a dot,
 * then a `<PascalName>` word (e.g. `entries.EntrySubmitted`).
 */
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*\.[A-Z][a-zA-Z0-9]*(?![\s\S])/;

/**
 * Casts a raw string to an {@link EventType}, **validating** it is in
 * `<context>.<PascalName>` form (e.g. `'entries.EntrySubmitted'`).
 *
 * `EventType` is the one branded id whose constructor is a validating factory
 * rather than a plain cast: an invalid event-type name must never reach the
 * outbox, so malformed values are rejected at the boundary instead of being
 * silently branded. Use this wherever an event type enters the domain — in a
 * class event's construction path (e.g. `EntrySubmitted.from`), and in
 * `decodeDomainEvent` when restoring an event from its JSON / database form.
 *
 * @throws {TypeError} when `value` does not match `<word>.<PascalWord>`.
 */
export const asEventType = (value: string): EventType => {
    if (!EVENT_TYPE_PATTERN.test(value)) {
        throw new TypeError(
            `Invalid EventType '${value}': expected '<context>.<PascalName>' (e.g. 'entries.EntrySubmitted').`,
        );
    }
    return value as EventType;
};
