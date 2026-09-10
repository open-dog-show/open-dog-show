// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { DomainEvent, CreateDomainEventParams } from './domain/domain-event.js';
export { createDomainEvent } from './domain/domain-event.js';
export { EventScope, asEventScope } from './domain/event-scope.js';
export type { Clock, EventIdGenerator } from './domain/domain-ports.js';
export type {
    ShowId,
    DogId,
    ClubId,
    PrincipalId,
    EventId,
    EventType,
    AggregateId,
} from './domain/domain-ids.js';
export {
    asShowId,
    asDogId,
    asClubId,
    asPrincipalId,
    asEventId,
    asEventType,
    asAggregateId,
} from './domain/domain-ids.js';
export type { DomainEventJson } from './domain/domain-event-codec.js';
export {
    encodeDomainEvent,
    decodeDomainEvent,
    InvalidDomainEventEnvelopeError,
} from './domain/domain-event-codec.js';
export { DomainError } from './domain/domain-error.js';
export type { Result } from './application/result.js';
export type { OutboxAppender } from './application/ports/outbox-appender.js';
export type { OutboxWriter } from './infrastructure/outbox-writer.js';
export { SystemClock } from './infrastructure/system-clock.js';
export { RandomEventIdGenerator } from './infrastructure/random-event-id-generator.js';
export { withTransaction, withOutboxTransaction } from './infrastructure/with-transaction.js';
export { PgOutboxWriter } from './infrastructure/pg-outbox-writer.js';
export { OutboxWriteFailed } from './infrastructure/outbox-write-failed.js';
export { PgPollingDispatcher } from './infrastructure/pg-polling-dispatcher.js';
export type { EventHandler } from './infrastructure/pg-polling-dispatcher.js';
export { quoteSchemaIdent } from './infrastructure/schema-ident.js';
export type { TransactionScope } from './domain/transaction-scope.js';
export {
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    transactionScopesEqual,
} from './domain/transaction-scope.js';
export { FakeClock } from './infrastructure/fake-clock.js';
export { FakeEventIdGenerator } from './infrastructure/fake-event-id-generator.js';
