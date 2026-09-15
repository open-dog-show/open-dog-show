// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { InvalidDomainEventEnvelopeError } from './domain-event-rehydration-registry.js';

/**
 * Narrows `payload` from `unknown` to an object whose `field` is a string,
 * throwing {@link InvalidDomainEventEnvelopeError} otherwise.
 *
 * Every context's `DomainEventRehydrator` must narrow the codec's untyped
 * `payload` to its own event's typed shape (the kernel cannot validate a
 * payload shape it knows nothing about) — this covers the common
 * single-required-string-field case so a context's narrowing guard only
 * names the field, rather than re-implementing the `typeof`/`null` check.
 * A payload with more than one required field, or a non-string field, still
 * needs its own guard.
 */
export function assertPayloadHasStringField<TField extends string>(
    payload: unknown,
    field: TField,
): asserts payload is Record<TField, string> {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        typeof (payload as Record<string, unknown>)[field] !== 'string'
    ) {
        throw new InvalidDomainEventEnvelopeError('payload', payload);
    }
}
