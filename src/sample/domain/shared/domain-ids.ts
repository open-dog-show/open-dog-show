// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;

/**
 * Compile-time brand helper — keeps the sample context's IDs distinct
 * from each other and from other strings even though all are plain strings at
 * runtime. A branded type is structurally identical to `T` at runtime but is
 * treated as a distinct type by the TypeScript compiler.
 */
type Brand<T, B> = T & { readonly [__brand]: B };

// plop:ids
/** Branded string that uniquely identifies an Announcement within the sample context. */
export type AnnouncementId = Brand<string, 'AnnouncementId'>;
/**
 * Casts a raw string to a {@link AnnouncementId}. Plain cast — no
 * validation. Call it at the outermost layer (repository, use-case boundary)
 * so the rest of the domain works exclusively with typed IDs.
 */
export const asAnnouncementId = (id: string): AnnouncementId => id as AnnouncementId;

/** Branded string that uniquely identifies a Ticket within the sample context. */
export type TicketId = Brand<string, 'TicketId'>;
/**
 * Casts a raw string to a {@link TicketId}. Plain cast — no
 * validation. Call it at the outermost layer (repository, use-case boundary)
 * so the rest of the domain works exclusively with typed IDs.
 */
export const asTicketId = (id: string): TicketId => id as TicketId;

/** Branded string that uniquely identifies a Note within the sample context. */
export type NoteId = Brand<string, 'NoteId'>;
/**
 * Casts a raw string to a {@link NoteId}. Plain cast — no
 * validation. Call it at the outermost layer (repository, use-case boundary)
 * so the rest of the domain works exclusively with typed IDs.
 */
export const asNoteId = (id: string): NoteId => id as NoteId;

/** Branded string that uniquely identifies an Item within the sample context. */
export type ItemId = Brand<string, 'ItemId'>;
/**
 * Casts a raw string to a {@link ItemId}. Plain cast — no
 * validation. Call it at the outermost layer (repository, use-case boundary)
 * so the rest of the domain works exclusively with typed IDs.
 */
export const asItemId = (id: string): ItemId => id as ItemId;
