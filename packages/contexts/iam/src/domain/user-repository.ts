// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '@ods/kernel';
import type { User } from './user.js';

export interface UserRepository {
    findById(id: UserId): Promise<User | undefined>;
    findByExternalSubject(subject: string): Promise<User | undefined>;
    save(user: User): Promise<void>;
}
