// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { asClubId } from '../../../../../src/Shared/index.js';
import { asShowId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import { Show } from '../../../../../src/sample/domain/model/show/show.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const SHOW_ID = asShowId('00000000-0000-4000-8000-000000000021');

describe('Show.create', () => {
    it('constructs with the expected shape', () => {
        const show = Show.create(SHOW_ID, CLUB_ID, 'Spring Championship');

        expect(show).toBeInstanceOf(Show);
        expect(show.id).toBe(SHOW_ID);
        expect(show.clubId).toBe(CLUB_ID);
        expect(show.name).toBe('Spring Championship');
    });
});

describe('Show.rehydrate', () => {
    it('rebuilds a Show from stored fields', () => {
        const show = Show.rehydrate(SHOW_ID, CLUB_ID, 'Spring Championship');

        expect(show).toBeInstanceOf(Show);
        expect(show.id).toBe(SHOW_ID);
        expect(show.clubId).toBe(CLUB_ID);
        expect(show.name).toBe('Spring Championship');
    });

    it('rehydrates equal-by-field to a created show of the same data', () => {
        const created = Show.create(SHOW_ID, CLUB_ID, 'Spring Championship');
        const rehydrated = Show.rehydrate(created.id, created.clubId, created.name);

        expect(rehydrated).toEqual(created);
    });
});

describe('Show nominal brand', () => {
    it('is not assignable from a structural object literal (the #brand closes the leak)', () => {
        // A bare { id, clubId, name } literal lacks the private #brand field, so
        // it is not assignable to `Show` — mirrors Entry/User/RoleGrant.
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAShow: Show = {
            id: SHOW_ID,
            clubId: CLUB_ID,
            name: 'Spring Championship',
        };
        expect(notAShow).toBeDefined();
    });
});
