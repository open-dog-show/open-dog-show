// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '@ods/kernel';
import type { User } from './user.js';

export class UserSuspendedError extends Error {
    readonly userId: UserId;

    constructor(user: User) {
        super(`User ${user.id} is suspended and cannot authenticate`);
        this.name = 'UserSuspendedError';
        this.userId = user.id;
    }
}
