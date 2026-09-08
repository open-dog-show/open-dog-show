// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId } from '../../../../Shared/index.js';
import type { ShowId } from '../../shared/domain-ids.js';

export interface Show {
    readonly id: ShowId;
    readonly clubId: ClubId;
    readonly name: string;
}
