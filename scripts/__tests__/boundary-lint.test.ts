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
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '../..');

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
        const violations = await lint(`import type { TenantId } from '@ods/kernel';\n`, domainPath);
        expect(violations, 'domain → @ods/kernel should be allowed').toHaveLength(0);
    });
});
