// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { pgSchema, uuid, text } from 'drizzle-orm/pg-core';

const schema = pgSchema('sample');

export const showsTable = schema.table('shows', {
    id: uuid('id').primaryKey(),
    clubId: uuid('club_id').notNull(),
    name: text('name').notNull(),
});

export const entriesTable = schema.table('entries', {
    id: uuid('id').primaryKey(),
    clubId: uuid('club_id').notNull(),
    // The TS field is `principalId` (the kernel's context-neutral actor id,
    // ADR-0013); the SQL column stays `user_id` (ADR-0005 wire name unchanged).
    principalId: uuid('user_id').notNull(),
    showId: uuid('show_id').notNull(),
    dogName: text('dog_name').notNull(),
});
