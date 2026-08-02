// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId } from '@ods/kernel';

export interface Show {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly name: string;
}

export interface ShowRepository {
    findAll(): Promise<Show[]>;
    save(show: Show): Promise<void>;
}
