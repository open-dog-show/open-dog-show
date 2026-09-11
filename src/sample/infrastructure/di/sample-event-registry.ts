// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainEventRehydrationRegistry,
    InvalidDomainEventEnvelopeError,
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
    if (
        typeof payload !== 'object' ||
        payload === null ||
        typeof (payload as { dogName?: unknown }).dogName !== 'string'
    ) {
        throw new InvalidDomainEventEnvelopeError('payload', payload);
    }
    return payload as EntrySubmittedPayload;
}

/**
 * Builds the sample context's event-type → class rehydration registry
 * (ADR-0022 class events, issue #172).
 *
 * Each registered rehydrator constructs the concrete class event from the
 * already-validated envelope fields the kernel codec hands it, narrowing the
 * `payload` from `unknown` to the event's typed shape at this boundary (the
 * codec cannot validate a payload shape it knows nothing about). The returned
 * registry is passed to the polling dispatcher so a stored outbox row is
 * rehydrated back into its class instance instead of the generic
 * `DomainEvent<unknown>` envelope.
 *
 * Lives in the sample context's `infrastructure/di/` because the kernel cannot
 * import a context's event classes — the composition root owns the wiring
 * (ADR-0004 dependencies point inward; contexts never import each other).
 */
export function buildSampleEventRehydrationRegistry(): DomainEventRehydrationRegistry {
    const registry = new DomainEventRehydrationRegistry();
    registry.register(ENTRY_SUBMITTED_TYPE, (envelope) =>
        EntrySubmitted.rehydrate({
            eventId: envelope.eventId,
            occurredAt: envelope.occurredAt,
            scope: envelope.scope,
            aggregateId: envelope.aggregateId,
            payload: asEntrySubmittedPayload(envelope.payload),
        }),
    );
    return registry;
}
