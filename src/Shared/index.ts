// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { DomainEvent, DomainEventFact } from './domain/domain-event.js';
export { stampDomainEvent } from './domain/domain-event.js';
export type { EventScope } from './domain/event-scope.js';
export {
    ClubEventScope,
    ExhibitorEventScope,
    PlatformEventScope,
    eventScopesEqual,
    asEventScope,
} from './domain/event-scope.js';
export type { Clock, EventIdGenerator } from './domain/domain-ports.js';
export type { ClubId, PrincipalId, EventId, EventType, AggregateId } from './domain/domain-ids.js';
export {
    asClubId,
    asPrincipalId,
    asEventId,
    asEventType,
    asAggregateId,
} from './domain/domain-ids.js';
export { AggregateRoot } from './domain/aggregate-root.js';
export { DomainError } from './domain/domain-error.js';
export { requireClubScope, requireActor } from './domain/require-scope.js';
export { ScopeMismatchError } from './domain/scope-mismatch-error.js';
export type { Result } from './application/result.js';
export type { TransactionScope } from './domain/transaction-scope.js';
export {
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    transactionScopesEqual,
} from './domain/transaction-scope.js';
export type {
    DomainEventJson,
    DomainEventRehydrator,
} from './infrastructure/messaging/domain-event-codec.js';
export {
    encodeDomainEvent,
    decodeDomainEvent,
    rehydrateDomainEvent,
    InvalidDomainEventEnvelopeError,
    UnregisteredDomainEventTypeError,
    DomainEventRehydrationRegistry,
    assertPayloadHasStringField,
} from './infrastructure/messaging/domain-event-codec.js';
export { SystemClock } from './infrastructure/system-clock.js';
export { RandomEventIdGenerator } from './infrastructure/random-event-id-generator.js';
export {
    withTransaction,
    withOutboxTransaction,
} from './infrastructure/persistence/postgres/with-transaction.js';
export { PgOutboxWriter } from './infrastructure/persistence/postgres/pg-outbox-writer.js';
export { OutboxWriteFailed } from './infrastructure/persistence/postgres/outbox-write-failed.js';
export { TransactionFailed } from './infrastructure/persistence/postgres/transaction-failed.js';
export { OutboxDispatchFailed } from './infrastructure/persistence/postgres/outbox-dispatch-failed.js';
export { PgPollingDispatcher } from './infrastructure/persistence/postgres/pg-polling-dispatcher.js';
export type { EventHandler } from './infrastructure/persistence/postgres/pg-polling-dispatcher.js';
export { quoteSchemaIdent } from './infrastructure/persistence/postgres/schema-ident.js';
