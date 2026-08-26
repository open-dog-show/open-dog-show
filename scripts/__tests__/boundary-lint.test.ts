// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Verifies that the eslint-plugin-boundaries configuration correctly blocks
 * illegal cross-layer and cross-context imports.
 *
 * Seam: the `boundaries/dependencies` ESLint rule, configured in eslint.config.js.
 */

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Helper: run the root eslint.config.js on a code snippet at a virtual path.
async function lint(code: string, virtualPath: string): Promise<string[]> {
    const eslint = new ESLint({ cwd: rootDir });
    const results = await eslint.lintText(code, {
        filePath: resolve(rootDir, virtualPath),
        warnIgnored: false,
    });
    return results
        .flatMap((r) => r.messages)
        .filter((m) => m.ruleId === 'boundaries/dependencies')
        .map((m) => m.message);
}

const domainPath = 'packages/contexts/sample/src/domain/check.ts';
const infraPath = 'packages/contexts/sample/src/infrastructure/check.ts';
const iamDomainPath = 'packages/contexts/iam/src/domain/check.ts';

// ── Cross-layer violations ─────────────────────────────────────────────────

describe('cross-layer boundary enforcement', () => {
    it('blocks domain layer from importing infrastructure', async () => {
        const violations = await lint(
            `import { entriesTable } from '../infrastructure/schema.js';\n`,
            domainPath,
        );
        expect(violations.length, 'expected a boundaries/dependencies error').toBeGreaterThan(0);
    });

    it('allows infrastructure layer to import domain', async () => {
        const violations = await lint(
            `import type { Entry } from '../domain/entry.js';\n`,
            infraPath,
        );
        expect(violations, 'infra → domain should be allowed').toHaveLength(0);
    });

    it('blocks infrastructure from importing another context via its package', async () => {
        // Context-zone enforcement: no @ods/* context package other than
        // @ods/kernel is importable from infrastructure. Any Payments/Identity
        // integration must go through an explicit ACL adapter entry in the policy.
        const violations = await lint(`import type { x } from '@ods/judging';\n`, infraPath);
        expect(
            violations.length,
            'cross-context package import from infra expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });
});

// ── Cross-context violations ───────────────────────────────────────────────

describe('cross-context boundary enforcement', () => {
    it('blocks domain from importing another @ods context package', async () => {
        const violations = await lint(`import type { Dog } from '@ods/judging';\n`, domainPath);
        expect(violations.length, 'expected a boundaries/dependencies error').toBeGreaterThan(0);
    });

    it('allows domain to import @ods/kernel', async () => {
        const violations = await lint(`import type { ClubId } from '@ods/kernel';\n`, domainPath);
        expect(violations, 'domain → @ods/kernel should be allowed').toHaveLength(0);
    });
});

// ── IAM-identity ownership (ADR-0013) ───────────────────────────────────────
// The kernel owns the context-neutral `PrincipalId`; `UserId` is owned by
// `@ods/iam`. A downstream context domain layer must not import IAM's
// `UserId` (or the dead `ExhibitorId` brand) from the kernel — the ownership
// split is enforced in CI, not just by convention. The context-neutral
// `PrincipalId` (and `ClubId`, above) remain importable from the kernel.

describe('identity-ownership boundary enforcement', () => {
    it('blocks a downstream domain layer from importing UserId from @ods/kernel', async () => {
        const violations = await lint(`import type { UserId } from '@ods/kernel';\n`, domainPath);
        expect(
            violations.length,
            'domain importing UserId from @ods/kernel should be a boundaries/dependencies violation',
        ).toBeGreaterThan(0);
    });

    it('blocks a downstream domain layer from importing asUserId from @ods/kernel', async () => {
        const violations = await lint(`import { asUserId } from '@ods/kernel';\n`, domainPath);
        expect(
            violations.length,
            'importing the UserId caster should be blocked too',
        ).toBeGreaterThan(0);
    });

    it('blocks a downstream domain layer from importing the dead ExhibitorId brand from @ods/kernel', async () => {
        const violations = await lint(
            `import type { ExhibitorId } from '@ods/kernel';\n`,
            domainPath,
        );
        expect(
            violations.length,
            'ExhibitorId was removed from the kernel; importing it should be a boundaries/dependencies violation',
        ).toBeGreaterThan(0);
    });

    it('still allows a downstream domain layer to import PrincipalId from @ods/kernel', async () => {
        const violations = await lint(
            `import type { PrincipalId } from '@ods/kernel';\n`,
            domainPath,
        );
        expect(
            violations,
            'PrincipalId is the context-neutral actor id and remains allowed from the kernel',
        ).toHaveLength(0);
    });

    it('allows @ods/iam domain to import UserId from its own package', async () => {
        const violations = await lint(
            `import type { UserId } from './domain-ids.js';\n`,
            iamDomainPath,
        );
        expect(
            violations,
            '@ods/iam owns UserId; importing it from its own package should be allowed',
        ).toHaveLength(0);
    });
});
