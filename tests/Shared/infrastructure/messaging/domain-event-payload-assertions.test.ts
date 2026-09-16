// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import { assertPayloadHasStringField } from '../../../../src/Shared/infrastructure/messaging/domain-event-payload-assertions.js';
import { InvalidDomainEventEnvelopeError } from '../../../../src/Shared/infrastructure/messaging/domain-event-rehydration-registry.js';

describe('assertPayloadHasStringField', () => {
    it('does not throw when the field is a string', () => {
        expect(() => {
            assertPayloadHasStringField({ dogName: 'Fido' }, 'dogName');
        }).not.toThrow();
    });

    it('narrows payload so the field is accessible as a string', () => {
        const payload: unknown = { dogName: 'Fido' };
        assertPayloadHasStringField(payload, 'dogName');
        expectTypeOf(payload.dogName).toEqualTypeOf<string>();
    });

    it.each([
        ['a non-object payload', 'not-an-object'],
        ['null', null],
        ['an object missing the field', {}],
        ['an object with a non-string field', { dogName: 42 }],
    ])('throws InvalidDomainEventEnvelopeError for %s', (_label, payload) => {
        expect(() => {
            assertPayloadHasStringField(payload, 'dogName');
        }).toThrow(InvalidDomainEventEnvelopeError);
    });
});
