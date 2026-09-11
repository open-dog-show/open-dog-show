// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { PgPollingDispatcher } from '../../../src/Shared/infrastructure/pg-polling-dispatcher.js';
import { DomainEventRehydrationRegistry } from '../../../src/Shared/domain/domain-event-codec.js';

describe('PgPollingDispatcher construction', () => {
    it('throws a clear TypeError when constructed without a registry (registry is required, ADR-0022/#176)', () => {
        const fakePool = {} as unknown as pg.Pool;

        expect(
            () =>
                new PgPollingDispatcher(
                    fakePool,
                    'sample',
                    async () => {},
                    // @ts-expect-error — registry is required; this pins the runtime guard for a caller that bypasses tsc.
                    undefined,
                ),
        ).toThrow(TypeError);
    });

    it('accepts a registry and does not throw at construction', () => {
        const fakePool = {} as unknown as pg.Pool;

        expect(
            () =>
                new PgPollingDispatcher(
                    fakePool,
                    'sample',
                    async () => {},
                    new DomainEventRehydrationRegistry(),
                ),
        ).not.toThrow();
    });
});
