// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type ShowId = Brand<string, 'ShowId'>;
export type DogId = Brand<string, 'DogId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type ExhibitorId = Brand<string, 'ExhibitorId'>;
export type AccountId = Brand<string, 'AccountId'>;

export const asShowId = (id: string): ShowId => id as ShowId;
export const asDogId = (id: string): DogId => id as DogId;
export const asTenantId = (id: string): TenantId => id as TenantId;
export const asExhibitorId = (id: string): ExhibitorId => id as ExhibitorId;
export const asAccountId = (id: string): AccountId => id as AccountId;
