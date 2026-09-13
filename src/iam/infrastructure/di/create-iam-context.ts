// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEventRehydrationRegistry } from '../../../Shared/index.js';
import { AuthenticateHandler } from '../../application/authenticate/authenticate.js';
import { IdentityQuery } from '../../application/identity-query/identity-query.js';
import type { IamUnitOfWork } from '../../application/ports/unit-of-work.js';
import type { IdentityProvider } from '../../domain/model/user/identity-provider.js';
import type { UserIdGenerator } from '../../domain/model/user/user-id-generator.js';
import { buildIamEventRehydrationRegistry } from '../messaging/iam-event-registry.js';

/**
 * Dependencies the composition root supplies to wire the IAM context.
 *
 * Unlike the sample context's `createSampleContext` (which builds its own
 * `PgSampleUnitOfWork` from a pool + outbox writer), IAM has no Postgres
 * `IamUnitOfWork` implementation yet (#189) — the composition root supplies
 * whichever implementation exists (today, only `FakeIamUnitOfWork`) already
 * constructed.
 */
export interface IamContextDependencies {
    readonly unitOfWork: IamUnitOfWork;
    readonly identityProvider: IdentityProvider;
    readonly userIdGenerator: UserIdGenerator;
}

/** The IAM context's published use cases and event rehydration registry (ADR-0028). */
export interface IamContext {
    readonly authenticate: AuthenticateHandler;
    readonly identityQuery: IdentityQuery;
    readonly eventRegistry: DomainEventRehydrationRegistry;
}

/**
 * Wires the IAM context's use cases and event rehydration registry from the
 * given dependencies (ADR-0021's `infrastructure/di/`). The composition root
 * (`apps/`) is the only intended caller; it passes `eventRegistry` to the
 * outbox codec / polling dispatcher so a stored `iam.RoleGranted`/
 * `iam.RoleRevoked` row can be rehydrated back into its class instance.
 */
export function createIamContext(deps: IamContextDependencies): IamContext {
    return {
        authenticate: new AuthenticateHandler(
            deps.unitOfWork,
            deps.identityProvider,
            deps.userIdGenerator,
        ),
        identityQuery: new IdentityQuery(deps.unitOfWork),
        eventRegistry: buildIamEventRehydrationRegistry(),
    };
}
