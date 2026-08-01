// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { DomainEvent, EventScope, CreateDomainEventParams } from './domain/DomainEvent.js';
export { createDomainEvent } from './domain/DomainEvent.js';
export type { Clock, IdGenerator } from './domain/ports.js';
export type { ShowId, DogId, TenantId, ExhibitorId, AccountId } from './domain/ids.js';
export { asShowId, asDogId, asTenantId, asExhibitorId, asAccountId } from './domain/ids.js';
