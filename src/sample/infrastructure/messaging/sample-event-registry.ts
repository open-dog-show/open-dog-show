// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainEventRehydrationRegistry,
    assertPayloadHasStringField,
} from '../../../Shared/index.js';
import {
    ENTRY_SUBMITTED_TYPE,
    EntrySubmitted,
    type EntrySubmittedPayload,
} from '../../domain/model/entry/events/entry-submitted.js';

/**
 * Narrows `payload` from `unknown` to {@link EntrySubmittedPayload}, rejecting
 * a malformed outbox row (e.g. `{}`) instead of letting a bare type assertion
 * produce an `EntrySubmitted` whose advertised `dogName: string` is actually
 * `undefined`.
 */
function asEntrySubmittedPayload(payload: unknown): EntrySubmittedPayload {
    assertPayloadHasStringField(payload, 'dogName');
    return payload;
}

/**
 * Builds the sample context's event-type → class rehydration registry
 * (ADR-0022 class events, issue #172).
 *
 * Each registered rehydrator constructs the concrete class event from the
 * already-validated fact fields the kernel codec hands it (`type`, `scope`,
 * `aggregateId`, `payload` — never `eventId`/`occurredAt`, which are
 * envelope-only fields the codec attaches afterwards, ADR-0027), narrowing
 * the `payload` from `unknown` to the event's typed shape at this boundary.
 * The returned registry is passed to the polling dispatcher so a stored
 * outbox row is rehydrated back into its class instance — an unregistered
 * type throws instead of falling back to a generic envelope (ADR-0022,
 * #176), so this registry must cover every type the sample context emits.
 *
 * Lives in the sample context's `infrastructure/messaging/` (ADR-0021's
 * 2026-09-11 amendment: event rehydration registries live in
 * `infrastructure/messaging/`, not `infrastructure/di/`) because the kernel
 * cannot import a context's event classes — the composition root owns the
 * wiring (ADR-0004 dependencies point inward; contexts never import each
 * other).
 */
export function buildSampleEventRehydrationRegistry(): DomainEventRehydrationRegistry {
    const registry = new DomainEventRehydrationRegistry();
    registry.register(ENTRY_SUBMITTED_TYPE, ({ scope, aggregateId, payload }) =>
        EntrySubmitted.rehydrate({
            scope,
            aggregateId,
            payload: asEntrySubmittedPayload(payload),
        }),
    );
    return registry;
}
