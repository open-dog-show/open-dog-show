// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { DomainEvent, EventScope, CreateDomainEventParams, AggregateId } from './domain/domain-event.js';
export { createDomainEvent } from './domain/domain-event.js';
export type { Clock, IdGenerator } from './domain/domain-ports.js';
export type { ShowId, DogId, TenantId, ExhibitorId, UserId } from './domain/domain-ids.js';
export { asShowId, asDogId, asTenantId, asExhibitorId, asUserId } from './domain/domain-ids.js';
export type { DomainEventJson } from './domain/domain-event-codec.js';
export { encodeDomainEvent, decodeDomainEvent } from './domain/domain-event-codec.js';
export type { DomainEventCollector } from './domain/domain-event-collector.js';
export type { TransactionScope } from './domain/transaction-scope.js';
