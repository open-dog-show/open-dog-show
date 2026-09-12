// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DomainError, type ClubId } from '../../../../Shared/index.js';
import type { ShowId } from '../../shared/domain-ids.js';

/**
 * A Show — a sanctioned conformation exhibition run by a Club.
 *
 * Modelled as a class aggregate (ADR-0022): a private `#brand` field makes the
 * class **nominal** so a bare `{ id, clubId, name }` object literal (the TS
 * structural-literal leak a `private constructor` cannot block on its own) is
 * not assignable to `Show` — the type is closed against direct
 * structural-literal construction (mirrors `Entry`/`User`/`RoleGrant`).
 * {@link Show.create} and {@link Show.rehydrate} are the two construction
 * paths (new vs. reconstituted from storage), kept as separate named
 * factories per the harness even though their bodies are currently identical
 * — Show carries no invariant today, but the split leaves a place for one to
 * land on exactly one path (e.g. a future creation-only rule) without
 * reshaping call sites, the same reasoning the harness gives for
 * `Order.place`/`Order.fromSnapshot`.
 */
export class Show {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `Show` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly id: ShowId;
    readonly clubId: ClubId;
    readonly name: string;

    private constructor(id: ShowId, clubId: ClubId, name: string) {
        this.id = id;
        this.clubId = clubId;
        this.name = name;
    }

    /** Factory for a new Show, hosted by `clubId` under the given `name`. */
    static create(id: ShowId, clubId: ClubId, name: string): Show {
        return new Show(id, clubId, name);
    }

    /** Rehydrates a {@link Show} from storage columns — the repository-load path. */
    static rehydrate(id: ShowId, clubId: ClubId, name: string): Show {
        return new Show(id, clubId, name);
    }
}

/**
 * Thrown when a use case looks up a {@link Show} by id and none exists —
 * e.g. `SaveEntryUseCase` deriving an Entry's owning `clubId` from the Show
 * it is submitted to (ADR-0026: "the owning Club comes from the Show being
 * entered").
 */
export class ShowNotFoundError extends DomainError {
    readonly showId: ShowId;

    constructor(showId: ShowId) {
        super(`No Show found with id '${showId}'`, { showId });
        this.showId = showId;
    }
}
