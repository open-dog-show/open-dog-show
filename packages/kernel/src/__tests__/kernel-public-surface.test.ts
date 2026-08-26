// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import * as kernel from '../index.js';
import type { PrincipalId } from '../index.js';

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
        // @ts-expect-error — UserId moved to @ods/iam (ADR-0013); the kernel owns only PrincipalId
        const _userId: kernel.UserId = null as never;
        expect(_userId).toBeNull();
    });

    it('does not export the IAM-owned asUserId caster', () => {
        // @ts-expect-error — asUserId moved to @ods/iam (ADR-0013)
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
