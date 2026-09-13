// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { pgSchema, uuid, text } from 'drizzle-orm/pg-core';

export const schema = pgSchema('sample');

// plop:tables
export const announcementsTable = schema.table('announcements', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
});

export const ticketsTable = schema.table('tickets', {
    id: uuid('id').primaryKey(),
    clubId: uuid('club_id').notNull(),
    principalId: uuid('user_id').notNull(),
    itemId: uuid('item_id').notNull(),
    name: text('name').notNull(),
});

export const notesTable = schema.table('notes', {
    id: uuid('id').primaryKey(),
    principalId: uuid('user_id').notNull(),
    name: text('name').notNull(),
});

export const itemsTable = schema.table('items', {
    id: uuid('id').primaryKey(),
    clubId: uuid('club_id').notNull(),
    principalId: uuid('user_id').notNull(),
    name: text('name').notNull(),
});
