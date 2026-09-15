// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    AggregateRoot,
    asAggregateId,
    PlatformEventScope,
    DomainError,
} from '../../../../Shared/index.js';
import type { AnnouncementId } from '../../shared/domain-ids.js';
import { AnnouncementCreated } from './events/announcement-created.js';
import { AnnouncementRenamed } from './events/announcement-renamed.js';

/** The version every new Announcement starts at — bumped only by `AnnouncementRepository.update`. */
const INITIAL_VERSION = 1;

/**
 * An Announcement — a platform-scoped placeholder aggregate generated
 * by `new:aggregate --scope platform` (ADR-0025/0026/0027).
 *
 * Modelled as a class aggregate extending {@link AggregateRoot}: platform
 * data has no single owner (ADR-0005), so an Announcement carries
 * neither a `clubId` nor a `createdBy` — both {@link create} and
 * {@link rename} record their own fact, scoped platform-wide
 * (`PlatformEventScope`, ADR-0027). A private `#brand` field makes the class
 * **nominal** so a bare `{ id, name }` object literal is not assignable to
 * `Announcement` — the type is closed against unvalidated
 * construction. Storage load goes through {@link Announcement.rehydrate},
 * which does not record an event.
 *
 * `version` is a plain optimistic-concurrency stamp (mirrors IAM's `User`): a
 * mutator (`rename`) leaves it unchanged — bumping it is
 * `AnnouncementRepository.update`'s job, at the moment of the write, so a
 * stale `update` (the stored version has since moved) fails loudly
 * (`ConcurrentModificationError`) instead of silently overwriting a
 * concurrent change.
 */
export class Announcement extends AggregateRoot {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `Announcement` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;
    #name: string;

    readonly id: AnnouncementId;
    readonly version: number;

    get name(): string {
        return this.#name;
    }

    private constructor(input: {
        readonly id: AnnouncementId;
        readonly name: string;
        readonly version: number;
    }) {
        super();
        this.id = input.id;
        this.#name = input.name;
        this.version = input.version;
    }

    /** Creates a new Announcement, recording `AnnouncementCreated` scoped platform-wide, at version `1`. */
    static create(input: { readonly id: AnnouncementId; readonly name: string }): Announcement {
        assertAnnouncementName(input.name);
        const announcement = new Announcement({ ...input, version: INITIAL_VERSION });
        announcement.record(
            AnnouncementCreated.create(asAggregateId(announcement.id), PlatformEventScope.of(), {
                name: announcement.name,
            }),
        );
        return announcement;
    }

    /**
     * Rehydrates an Announcement from storage. No event is recorded —
     * rehydration replays past state, it does not produce a new fact.
     */
    static rehydrate(input: {
        readonly id: AnnouncementId;
        readonly name: string;
        readonly version: number;
    }): Announcement {
        return new Announcement(input);
    }

    /** Renames this Announcement, recording `AnnouncementRenamed` scoped platform-wide. */
    rename(name: string): void {
        assertAnnouncementName(name);
        this.#name = name;
        this.record(
            AnnouncementRenamed.create(asAggregateId(this.id), PlatformEventScope.of(), { name }),
        );
    }
}

function assertAnnouncementName(name: string): void {
    if (name.trim().length === 0) {
        throw new InvalidAnnouncementNameError(name);
    }
}

/** Thrown by {@link Announcement.create} / {@link Announcement.rename} for a blank name. */
export class InvalidAnnouncementNameError extends DomainError {
    constructor(name: string) {
        super(`Announcement name must not be blank (got '${name}')`, { name });
    }
}

/** Thrown when a use case looks up an Announcement by id and none exists — e.g. `RenameAnnouncementHandler`. */
export class AnnouncementNotFoundError extends DomainError {
    readonly id: AnnouncementId;

    constructor(id: AnnouncementId) {
        super(`No Announcement found with id '${id}'`, { id });
        this.id = id;
    }
}
