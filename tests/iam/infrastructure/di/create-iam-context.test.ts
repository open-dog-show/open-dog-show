// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { DomainEventRehydrationRegistry } from '../../../../src/Shared/index.js';
import { createIamContext } from '../../../../src/iam/infrastructure/di/create-iam-context.js';
import { AuthenticateHandler } from '../../../../src/iam/application/authenticate/authenticate.js';
import { IdentityQuery } from '../../../../src/iam/application/identity-query/identity-query.js';
import { ROLE_GRANTED_TYPE } from '../../../../src/iam/domain/model/user-role-grants/events/role-granted.js';
import { ROLE_REVOKED_TYPE } from '../../../../src/iam/domain/model/user-role-grants/events/role-revoked.js';
import { FakeIamUnitOfWork } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-iam-unit-of-work.js';
import { FakeIdentityProvider } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-identity-provider.js';
import { FakeUserIdGenerator } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-user-id-generator.js';

describe('createIamContext', () => {
    it('wires an AuthenticateHandler, an IdentityQuery, and a populated event registry', async () => {
        const token = 'token-alice';
        const context = createIamContext({
            unitOfWork: new FakeIamUnitOfWork(),
            identityProvider: new FakeIdentityProvider(
                new Map([[token, { sub: 'sub|alice', displayName: 'Alice', email: 'a@x.com' }]]),
            ),
            userIdGenerator: new FakeUserIdGenerator(),
        });

        expect(context.authenticate).toBeInstanceOf(AuthenticateHandler);
        expect(context.identityQuery).toBeInstanceOf(IdentityQuery);
        expect(context.eventRegistry).toBeInstanceOf(DomainEventRehydrationRegistry);
        expect(context.eventRegistry.rehydratorFor(ROLE_GRANTED_TYPE)).toBeDefined();
        expect(context.eventRegistry.rehydratorFor(ROLE_REVOKED_TYPE)).toBeDefined();

        const authResult = await context.authenticate.execute({ token });
        expect(authResult.ok).toBe(true);
    });
});
