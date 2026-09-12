// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { scopeToRlsKeys } from '../../../../../src/Shared/infrastructure/persistence/postgres/rls-keys.js';
import { asClubId, asPrincipalId } from '../../../../../src/Shared/domain/domain-ids.js';
import {
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
} from '../../../../../src/Shared/index.js';

describe('scopeToRlsKeys', () => {
    it('carries both clubId and principalId for a club scope', () => {
        const clubId = asClubId('00000000-0000-4000-8000-000000000001');
        const principalId = asPrincipalId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys(ClubTransactionScope.of(clubId, principalId))).toStrictEqual({
            clubId,
            principalId,
        });
    });

    it('carries only principalId (clubId null) for an exhibitor scope', () => {
        const principalId = asPrincipalId('00000000-0000-4000-8000-000000000011');

        expect(scopeToRlsKeys(ExhibitorTransactionScope.of(principalId))).toStrictEqual({
            clubId: null,
            principalId,
        });
    });

    it('nulls both keys for a platform scope', () => {
        expect(scopeToRlsKeys(PlatformTransactionScope.of())).toStrictEqual({
            clubId: null,
            principalId: null,
        });
    });

    it('preserves an applicable empty clubId and principalId for a club scope', () => {
        // asClubId/asPrincipalId are plain casts and accept ''; an applicable-but-empty
        // id must survive verbatim (not be normalized to null) so the outbox writer
        // binds it and PostgreSQL rejects it as an invalid UUID.
        expect(
            scopeToRlsKeys(ClubTransactionScope.of(asClubId(''), asPrincipalId(''))),
        ).toStrictEqual({ clubId: '', principalId: '' });
    });

    it('preserves an applicable empty principalId for an exhibitor scope', () => {
        expect(scopeToRlsKeys(ExhibitorTransactionScope.of(asPrincipalId('')))).toStrictEqual({
            clubId: null,
            principalId: '',
        });
    });
});
