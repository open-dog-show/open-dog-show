// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { PrincipalId } from '@ods/kernel';
import { asUserId } from '../domain/domain-ids.js';
import type { UserId } from '../domain/domain-ids.js';

describe('asUserId', () => {
    it('casts a raw string to a UserId, preserving the value', () => {
        expect(asUserId('user-alice')).toBe('user-alice');
    });

    it('preserves an applicable empty string verbatim (no normalization)', () => {
        // asUserId is a plain cast: an applicable-but-empty id must survive
        // verbatim rather than being silently normalized.
        expect(asUserId('')).toBe('');
    });

    it('returns a UserId-branded value', () => {
        expectTypeOf(asUserId('user-bob')).toEqualTypeOf<UserId>();
    });

    it('is a distinct brand from the kernel PrincipalId', () => {
        // IAM owns its own UserId brand (ADR-0013). It must not collapse into the
        // kernel's context-neutral PrincipalId, or the ACL cast seam — where a
        // UserId is cast to a PrincipalId at the composition root — loses its
        // meaning. The kernel no longer exports a UserId (it owns only
        // PrincipalId); this distinctness guard is the permanent invariant.
        expectTypeOf<UserId>().not.toEqualTypeOf<PrincipalId>();
    });
});
