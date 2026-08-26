// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { scopeToRlsKeys } from '../infrastructure/rls-keys.js';
import { asTenantId, asPrincipalId } from '../domain/domain-ids.js';

describe('scopeToRlsKeys', () => {
    it('carries both tenantId and principalId for a tenant scope', () => {
        const tenantId = asTenantId('00000000-0000-4000-8000-000000000001');
        const principalId = asPrincipalId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys({ kind: 'tenant', tenantId, principalId })).toStrictEqual({
            tenantId,
            principalId,
        });
    });

    it('carries only principalId (tenantId null) for an exhibitor scope', () => {
        const principalId = asPrincipalId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys({ kind: 'exhibitor', principalId })).toStrictEqual({
            tenantId: null,
            principalId,
        });
    });

    it('nulls both keys for a platform scope', () => {
        expect(scopeToRlsKeys({ kind: 'platform' })).toStrictEqual({
            tenantId: null,
            principalId: null,
        });
    });

    it('preserves an applicable empty tenantId and principalId for a tenant scope', () => {
        // asTenantId/asPrincipalId are plain casts and accept ''; an applicable-but-empty
        // id must survive verbatim (not be normalized to null) so the outbox writer
        // binds it and PostgreSQL rejects it as an invalid UUID.
        expect(
            scopeToRlsKeys({
                kind: 'tenant',
                tenantId: asTenantId(''),
                principalId: asPrincipalId(''),
            }),
        ).toStrictEqual({ tenantId: '', principalId: '' });
    });

    it('preserves an applicable empty principalId for an exhibitor scope', () => {
        expect(scopeToRlsKeys({ kind: 'exhibitor', principalId: asPrincipalId('') })).toStrictEqual(
            {
                tenantId: null,
                principalId: '',
            },
        );
    });
});
