// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { DomainEvent, EventScope, CreateDomainEventParams } from './domain/domain-event.js';
export { createDomainEvent } from './domain/domain-event.js';
export type { Clock, IdGenerator } from './domain/domain-ports.js';
export type { ShowId, DogId, TenantId, ExhibitorId, AccountId } from './domain/domain-ids.js';
export { asShowId, asDogId, asTenantId, asExhibitorId, asAccountId } from './domain/domain-ids.js';
export type { DomainEventJson } from './domain/domain-event-codec.js';
export { encodeDomainEvent, decodeDomainEvent } from './domain/domain-event-codec.js';
export type { OutboxAppender } from './domain/outbox-port.js';
export type { OutboxWriter } from './infrastructure/outbox-writer.js';
export { SystemClock } from './infrastructure/system-clock.js';
export { RandomIdGenerator } from './infrastructure/random-id-generator.js';
export { withTransaction } from './infrastructure/with-transaction.js';
export { PgOutboxWriter } from './infrastructure/pg-outbox-writer.js';
export { PgPollingDispatcher } from './infrastructure/pg-polling-dispatcher.js';
export type { EventHandler } from './infrastructure/pg-polling-dispatcher.js';
export type { TransactionScope } from './domain/transaction-scope.js';
export { FakeClock } from './testing/fake-clock.js';
export { FakeIdGenerator } from './testing/fake-id-generator.js';
