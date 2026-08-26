// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId } from '@ods/kernel';

export interface Entry {
    readonly id: string;
    readonly clubId: ClubId;
    readonly principalId: PrincipalId;
    readonly showId: string;
    readonly dogName: string;
}

export interface EntryRepository {
    findAll(): Promise<Entry[]>;
    save(entry: Entry): Promise<void>;
}
