// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainEventRehydrationRegistry,
    assertPayloadHasStringField,
    type AggregateId,
    type DomainEventFact,
    type EventScope,
    type EventType,
} from '../../../Shared/index.js';
// plop:imports
import {
    ANNOUNCEMENT_CREATED_TYPE,
    AnnouncementCreated,
} from '../../domain/model/announcement/events/announcement-created.js';
import {
    ANNOUNCEMENT_RENAMED_TYPE,
    AnnouncementRenamed,
} from '../../domain/model/announcement/events/announcement-renamed.js';

import {
    TICKET_CREATED_TYPE,
    TicketCreated,
} from '../../domain/model/ticket/events/ticket-created.js';
import {
    TICKET_RENAMED_TYPE,
    TicketRenamed,
} from '../../domain/model/ticket/events/ticket-renamed.js';

import { NOTE_CREATED_TYPE, NoteCreated } from '../../domain/model/note/events/note-created.js';
import { NOTE_RENAMED_TYPE, NoteRenamed } from '../../domain/model/note/events/note-renamed.js';

import { ITEM_CREATED_TYPE, ItemCreated } from '../../domain/model/item/events/item-created.js';
import { ITEM_RENAMED_TYPE, ItemRenamed } from '../../domain/model/item/events/item-renamed.js';

/**
 * Registers one `name`-payload event type: validates the fact's `payload` has
 * a string `name` field, then delegates to the concrete event class's
 * `rehydrate`. Every generated event shares this exact shape, so this is the
 * single place that shape is checked, instead of repeated per event type.
 */
function registerNamedEvent(
    registry: DomainEventRehydrationRegistry,
    type: EventType,
    rehydrate: (fields: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: Record<'name', string>;
    }) => DomainEventFact,
): void {
    registry.register(type, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return rehydrate({ scope, aggregateId, payload });
    });
}

/**
 * Builds the sample context's event-type → class rehydration
 * registry (ADR-0022 class events).
 *
 * Each registered rehydrator constructs the concrete class event from the
 * already-validated fact fields the kernel codec hands it (`type`, `scope`,
 * `aggregateId`, `payload` — never `eventId`/`occurredAt`, which are
 * envelope-only fields the codec attaches afterwards, ADR-0027), narrowing
 * `payload` from `unknown` to the event's typed shape at this boundary. The
 * returned registry is passed to the polling dispatcher so a stored outbox
 * row is rehydrated back into its class instance — an unregistered type
 * throws instead of falling back to a generic envelope, so this registry
 * must cover every type the sample context actually emits.
 *
 * Lives in the context's `infrastructure/messaging/` (not
 * `infrastructure/di/`) because the kernel cannot import a context's event
 * classes — the composition root owns the wiring.
 */
export function buildSampleEventRehydrationRegistry(): DomainEventRehydrationRegistry {
    const registry = new DomainEventRehydrationRegistry();
    // plop:registrations
    registerNamedEvent(registry, ANNOUNCEMENT_CREATED_TYPE, (f) =>
        AnnouncementCreated.rehydrate(f),
    );
    registerNamedEvent(registry, ANNOUNCEMENT_RENAMED_TYPE, (f) =>
        AnnouncementRenamed.rehydrate(f),
    );

    registerNamedEvent(registry, TICKET_CREATED_TYPE, (f) => TicketCreated.rehydrate(f));
    registerNamedEvent(registry, TICKET_RENAMED_TYPE, (f) => TicketRenamed.rehydrate(f));

    registerNamedEvent(registry, NOTE_CREATED_TYPE, (f) => NoteCreated.rehydrate(f));
    registerNamedEvent(registry, NOTE_RENAMED_TYPE, (f) => NoteRenamed.rehydrate(f));

    registerNamedEvent(registry, ITEM_CREATED_TYPE, (f) => ItemCreated.rehydrate(f));
    registerNamedEvent(registry, ITEM_RENAMED_TYPE, (f) => ItemRenamed.rehydrate(f));

    return registry;
}
