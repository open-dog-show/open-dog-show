// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { Brand } from './domain-ids.js';

/**
 * Branded string: an opaque reference to a judged entry (opaque to the
 * Rulesets context — Rulesets must not model `Entry`). Bare `string` is
 * interchangeable with other strings such as `kennelName`; the brand keeps
 * the entry-reference concept distinct at compile time, no runtime cost.
 */
export type EntryRef = Brand<string, 'EntryRef'>;
/** Casts a raw string to an {@link EntryRef}. */
export const asEntryRef = (ref: string): EntryRef => ref as EntryRef;
