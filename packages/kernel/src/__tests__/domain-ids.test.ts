// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import { asPrincipalId } from '../domain/domain-ids.js';
import type { PrincipalId } from '../domain/domain-ids.js';

describe('asPrincipalId', () => {
    it('casts a raw string to a PrincipalId, preserving the value', () => {
        expect(asPrincipalId('00000000-0000-4000-8000-000000000001')).toBe(
            '00000000-0000-4000-8000-000000000001',
        );
    });

    it('preserves an applicable empty string verbatim (no normalization)', () => {
        // asPrincipalId is a plain cast, identical in shape to asTenantId: an
        // applicable-but-empty id must survive verbatim so PostgreSQL rejects it
        // as an invalid UUID rather than being silently normalized.
        expect(asPrincipalId('')).toBe('');
    });

    it('returns a PrincipalId-branded value', () => {
        expectTypeOf(asPrincipalId('principal-1')).toEqualTypeOf<PrincipalId>();
    });
});
