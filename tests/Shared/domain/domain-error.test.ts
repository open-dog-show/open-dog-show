// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { DomainError } from '../../../src/Shared/domain/domain-error.js';
import { UserSuspendedError } from '../../../src/iam/domain/model/user/user.js';
import {
    DuplicateRoleGrantError,
    RoleGrant,
} from '../../../src/iam/domain/model/role-grant/role-grant.js';
import { InvalidLocalDateError } from '../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import {
    asUserId,
    asExternalSubject,
    asEmailAddress,
} from '../../../src/iam/domain/shared/domain-ids.js';

describe('DomainError base', () => {
    // A representative domain error from each context that migrated to the base.
    const suspended = new UserSuspendedError({
        id: asUserId('user-1'),
        displayName: 'A',
        email: asEmailAddress('a@x.com'),
        status: 'Suspended',
        externalSubject: asExternalSubject('sub|1'),
    });
    const duplicateGrant = new DuplicateRoleGrantError(
        RoleGrant.platformAdministrator(asUserId('user-1')),
    );
    const badDate = new InvalidLocalDateError(2026, 13, 99);

    it('every domain error is an instance of DomainError (and Error)', () => {
        for (const error of [suspended, duplicateGrant, badDate]) {
            expect(error).toBeInstanceOf(DomainError);
            expect(error).toBeInstanceOf(Error);
        }
    });

    it('name is set to the concrete subclass name via new.target (no manual assignment)', () => {
        expect(suspended.name).toBe('UserSuspendedError');
        expect(duplicateGrant.name).toBe('DuplicateRoleGrantError');
        expect(badDate.name).toBe('InvalidLocalDateError');
    });

    it('carries a loggable context bag the boundary handler can read generically', () => {
        expect(suspended.context).toEqual({ userId: 'user-1' });
        expect(duplicateGrant.context).toEqual({ userId: 'user-1', role: 'PlatformAdministrator' });
        expect(badDate.context).toEqual({ year: 2026, month: 13, day: 99 });
    });

    it('preserves its subclass-specific fields alongside the context bag', () => {
        expect(suspended.userId).toBe(asUserId('user-1'));
        expect(badDate.year).toBe(2026);
        expect(badDate.month).toBe(13);
        expect(badDate.day).toBe(99);
    });
});
