// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainEventRehydrationRegistry,
    assertPayloadHasStringField,
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
    registry.register(ANNOUNCEMENT_CREATED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return AnnouncementCreated.rehydrate({ scope, aggregateId, payload });
    });
    registry.register(ANNOUNCEMENT_RENAMED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return AnnouncementRenamed.rehydrate({ scope, aggregateId, payload });
    });

    registry.register(TICKET_CREATED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return TicketCreated.rehydrate({ scope, aggregateId, payload });
    });
    registry.register(TICKET_RENAMED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return TicketRenamed.rehydrate({ scope, aggregateId, payload });
    });

    registry.register(NOTE_CREATED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return NoteCreated.rehydrate({ scope, aggregateId, payload });
    });
    registry.register(NOTE_RENAMED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return NoteRenamed.rehydrate({ scope, aggregateId, payload });
    });

    registry.register(ITEM_CREATED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return ItemCreated.rehydrate({ scope, aggregateId, payload });
    });
    registry.register(ITEM_RENAMED_TYPE, ({ scope, aggregateId, payload }) => {
        assertPayloadHasStringField(payload, 'name');
        return ItemRenamed.rehydrate({ scope, aggregateId, payload });
    });

    return registry;
}
