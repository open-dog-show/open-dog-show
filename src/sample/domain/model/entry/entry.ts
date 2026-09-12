// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    AggregateRoot,
    asAggregateId,
    ClubEventScope,
    type ClubId,
    type PrincipalId,
} from '../../../../Shared/index.js';
import type { EntryId, ShowId } from '../../shared/domain-ids.js';
import { EntrySubmitted } from './events/entry-submitted.js';

/**
 * An Entry — a dog submitted to a Show by an exhibitor, owned by a Club.
 *
 * Modelled as a class aggregate (ADR-0022/0024) extending {@link AggregateRoot}
 * (ADR-0027): {@link Entry.submit} takes the owning `ClubId` and the acting
 * `PrincipalId` (`createdBy`) as typed inputs rather than deriving them from a
 * `TransactionScope` (ADR-0026) — an Entry is a **hybrid** aggregate: the
 * owning Club comes from the Show being entered, not from who is acting, so an
 * Exhibitor acting cross-Club can still submit an Entry owned by the Show's
 * Club. `submit` records the `EntrySubmitted` fact itself, scoped to the
 * owning Club (a hybrid aggregate's events are always `club(clubId)` —
 * ADR-0027). A private `#brand` field makes the class **nominal** so a bare
 * `{ id, clubId, … }` object literal (the TS structural-literal leak a
 * `private constructor` cannot block on its own) is not assignable to `Entry`
 * — the type is closed against unvalidated construction (mirrors `RoleGrant` /
 * `LocalDate`). Storage load goes through {@link Entry.rehydrate}, the one
 * other construction path (it does not record an event — only a fresh
 * submission does).
 */
export class Entry extends AggregateRoot {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `Entry` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly id: EntryId;
    readonly clubId: ClubId;
    readonly createdBy: PrincipalId;
    readonly showId: ShowId;
    readonly dogName: string;

    private constructor(
        id: EntryId,
        clubId: ClubId,
        createdBy: PrincipalId,
        showId: ShowId,
        dogName: string,
    ) {
        super();
        this.id = id;
        this.clubId = clubId;
        this.createdBy = createdBy;
        this.showId = showId;
        this.dogName = dogName;
    }

    /**
     * Submit an Entry, recording `EntrySubmitted` scoped to the owning Club
     * (`input.clubId`) — an Entry is Club-owned regardless of which scope the
     * acting principal (`input.createdBy`) submitted it under (ADR-0026).
     */
    static submit(input: EntryInput): Entry {
        const entry = new Entry(
            input.id,
            input.clubId,
            input.createdBy,
            input.showId,
            input.dogName,
        );
        entry.record(
            EntrySubmitted.create(asAggregateId(entry.id), ClubEventScope.of(entry.clubId), {
                dogName: entry.dogName,
            }),
        );
        return entry;
    }

    /**
     * Rehydrates an {@link Entry} from storage. The owning `ClubId` and acting
     * `PrincipalId` are supplied directly (a stored row carries them as
     * columns). No event is recorded — rehydration replays past state, it
     * does not produce a new fact. The `#brand` field forces repositories
     * onto this path instead of building an `Entry` literal (V2).
     */
    static rehydrate(input: {
        readonly id: EntryId;
        readonly clubId: ClubId;
        readonly createdBy: PrincipalId;
        readonly showId: ShowId;
        readonly dogName: string;
    }): Entry {
        return new Entry(input.id, input.clubId, input.createdBy, input.showId, input.dogName);
    }
}

/**
 * Inputs to {@link Entry.submit}: the Entry's own id, the Show it is submitted
 * to, the dog's call name, the owning Club (`clubId` — the Show's Club, not
 * necessarily the actor's), and the acting principal (`createdBy`).
 */
export interface EntryInput {
    readonly id: EntryId;
    readonly clubId: ClubId;
    readonly createdBy: PrincipalId;
    readonly showId: ShowId;
    readonly dogName: string;
}
