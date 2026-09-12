// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import * as kernel from '../../src/Shared/index.js';
import type { PrincipalId } from '../../src/Shared/index.js';

/**
 * Contract test for the identity-ownership split (ADR-0013, issue #106).
 *
 * The kernel's public surface owns the context-neutral `PrincipalId` and the
 * cross-cutting `ClubId` (RLS plumbing — ADR-0005/ADR-0013). The IAM-owned
 * `UserId` / `asUserId` and the dead `ExhibitorId` / `asExhibitorId` brands
 * were removed from the kernel once no caller remained (#104 / #105). This
 * test pins that invariant so it cannot regress.
 *
 * The `@ts-expect-error` guards are validated by `tsc` (`pnpm typecheck`), not
 * by vitest's runner — re-exporting any of these symbols turns the directive
 * unused (TS2578) and fails the typecheck. The runtime `not.toHaveProperty`
 * checks add defence-in-depth for the value casters. The context-neutral
 * `PrincipalId` (and `ClubId`) remain importable from the kernel.
 */
describe('kernel public surface — identity ownership (ADR-0013)', () => {
    it('exports the context-neutral PrincipalId and ClubId (RLS plumbing)', () => {
        expect(kernel).toHaveProperty('asPrincipalId');
        expect(kernel).toHaveProperty('asClubId');
        expectTypeOf(kernel.asPrincipalId('p-1')).toEqualTypeOf<PrincipalId>();
    });

    it('does not export the IAM-owned UserId type', () => {
        // @ts-expect-error — UserId moved to the IAM context (ADR-0013); the kernel owns only PrincipalId
        const _userId: kernel.UserId = null as never;
        expect(_userId).toBeNull();
    });

    it('does not export the IAM-owned asUserId caster', () => {
        // @ts-expect-error — asUserId moved to the IAM context (ADR-0013)
        const _asUserId = kernel.asUserId;
        expect(_asUserId).toBeUndefined();
        expect(kernel).not.toHaveProperty('asUserId');
    });

    it('does not export the dead ExhibitorId brand', () => {
        // @ts-expect-error — ExhibitorId was removed (ADR-0013); an Exhibitor is a capability, not an identity
        const _exhibitorId: kernel.ExhibitorId = null as never;
        expect(_exhibitorId).toBeNull();
    });

    it('does not export the dead asExhibitorId caster', () => {
        // @ts-expect-error — asExhibitorId was removed (ADR-0013)
        const _asExhibitorId = kernel.asExhibitorId;
        expect(_asExhibitorId).toBeUndefined();
        expect(kernel).not.toHaveProperty('asExhibitorId');
    });
});

/**
 * Contract test for the envelope-event retirement (ADR-0022, issue #176).
 *
 * `createDomainEvent` and its generic `DomainEvent<TPayload>` envelope were
 * retired once every real emitter became class-per-type. This test pins that
 * invariant so a future change cannot silently reintroduce the factory.
 */
describe('kernel public surface — envelope-event retirement (issue #176)', () => {
    it('does not export the retired createDomainEvent factory', () => {
        // @ts-expect-error — createDomainEvent was retired (ADR-0022, #176)
        const _createDomainEvent = kernel.createDomainEvent;
        expect(_createDomainEvent).toBeUndefined();
        expect(kernel).not.toHaveProperty('createDomainEvent');
    });

    it('does not accept a generic type parameter on DomainEvent', () => {
        // @ts-expect-error — DomainEvent is no longer generic (ADR-0022, #176)
        const _pin: kernel.DomainEvent<unknown> = null as never;
        expect(_pin).toBeNull();
    });
});

/**
 * Contract test for the T2 kernel reshape (ADR-0026/0027, issue #186).
 *
 * `ShowId`/`DogId` were plop-generator scaffolding that never belonged in the
 * kernel; `OutboxAppender` and the `OutboxWriter` interface are retired in
 * favour of aggregate roots recording events and a single `PgOutboxWriter`
 * implementation; the in-memory fakes leave the barrel so tests import them
 * by deep path instead.
 */
describe('kernel public surface — T2 kernel reshape (issue #186)', () => {
    it('does not export ShowId / DogId / asShowId / asDogId', () => {
        expect(kernel).not.toHaveProperty('asShowId');
        expect(kernel).not.toHaveProperty('asDogId');
        // @ts-expect-error — ShowId was removed from the kernel (issue #186)
        const _showId: kernel.ShowId = null as never;
        // @ts-expect-error — DogId was removed from the kernel (issue #186)
        const _dogId: kernel.DogId = null as never;
        expect(_showId).toBeNull();
        expect(_dogId).toBeNull();
    });

    it('does not export the retired OutboxAppender application port', () => {
        // @ts-expect-error — OutboxAppender was removed (ADR-0027, issue #186)
        const _pin: kernel.OutboxAppender = null as never;
        expect(_pin).toBeNull();
    });

    it('does not export the retired OutboxWriter interface', () => {
        // @ts-expect-error — OutboxWriter was removed; PgOutboxWriter is the sole impl (ADR-0027, issue #186)
        const _pin: kernel.OutboxWriter = null as never;
        expect(_pin).toBeNull();
    });

    it('does not export FakeClock / FakeEventIdGenerator from the barrel', () => {
        expect(kernel).not.toHaveProperty('FakeClock');
        expect(kernel).not.toHaveProperty('FakeEventIdGenerator');
    });

    it('exports AggregateRoot, ScopeMismatchError, requireClubScope, requireActor', () => {
        expect(kernel).toHaveProperty('AggregateRoot');
        expect(kernel).toHaveProperty('ScopeMismatchError');
        expect(kernel).toHaveProperty('requireClubScope');
        expect(kernel).toHaveProperty('requireActor');
    });

    it('exports TransactionFailed and OutboxDispatchFailed', () => {
        expect(kernel).toHaveProperty('TransactionFailed');
        expect(kernel).toHaveProperty('OutboxDispatchFailed');
    });
});
