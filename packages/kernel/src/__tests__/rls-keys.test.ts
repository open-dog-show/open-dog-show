// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { scopeToRlsKeys } from '../infrastructure/rls-keys.js';
import { asTenantId, asUserId } from '../domain/domain-ids.js';

describe('scopeToRlsKeys', () => {
    it('carries both tenantId and userId for a tenant scope', () => {
        const tenantId = asTenantId('00000000-0000-4000-8000-000000000001');
        const userId = asUserId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys({ kind: 'tenant', tenantId, userId })).toStrictEqual({
            tenantId,
            userId,
        });
    });

    it('carries only userId (tenantId empty) for an exhibitor scope', () => {
        const userId = asUserId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys({ kind: 'exhibitor', userId })).toStrictEqual({
            tenantId: '',
            userId,
        });
    });

    it('empties both keys for a platform scope', () => {
        expect(scopeToRlsKeys({ kind: 'platform' })).toStrictEqual({
            tenantId: '',
            userId: '',
        });
    });
});
