// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock, IdGenerator } from './domain-ports.js';

export type EventScope = 'tenant' | 'exhibitor' | 'platform';

export interface DomainEvent<TPayload> {
    readonly eventId: string;
    readonly type: string;
    readonly occurredAt: Date;
    readonly scope: EventScope;
    readonly aggregateId: string;
    readonly payload: TPayload;
}

export interface CreateDomainEventParams<TPayload> {
    readonly type: string;
    readonly scope: EventScope;
    readonly aggregateId: string;
    readonly payload: TPayload;
    readonly eventId?: string | undefined;
    readonly occurredAt?: Date | undefined;
}

export function createDomainEvent<TPayload>(
    params: CreateDomainEventParams<TPayload>,
    deps: { readonly clock: Clock; readonly idGenerator: IdGenerator },
): DomainEvent<TPayload> {
    return {
        eventId: params.eventId ?? deps.idGenerator.generate(),
        type: params.type,
        occurredAt: params.occurredAt ?? deps.clock.now(),
        scope: params.scope,
        aggregateId: params.aggregateId,
        payload: params.payload,
    };
}
