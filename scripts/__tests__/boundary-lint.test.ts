// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Verifies that the eslint-plugin-boundaries configuration correctly blocks
 * illegal cross-layer and cross-context imports.
 *
 * Seam: the `boundaries/dependencies` ESLint rule, configured in eslint.config.js.
 *
 * ADR-0020: the @ods/* workspace packages were replaced by a single src/ tree
 * with relative imports. Cross-context imports are now relative paths to another
 * context's folder; the same-context `capture` constraint plus `default:
 * 'disallow'` blocks them. The ADR-0013 `UserId`-ownership specifier ban (which
 * was keyed on the `@ods/kernel` module source) is no longer a boundaries rule —
 * the kernel barrel does not export `UserId`/`asUserId`/`ExhibitorId`/
 * `asExhibitorId`, so importing them from the kernel is a `tsc` error, and the
 * cross-context ban prevents importing them from IAM directly.
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

const domainPath = 'src/sample/domain/check.ts';
const infraPath = 'src/sample/infrastructure/check.ts';

// ── Cross-layer violations ─────────────────────────────────────────────────

describe('cross-layer boundary enforcement', () => {
    it('blocks domain layer from importing infrastructure', async () => {
        const violations = await lint(
            `import { entriesTable } from '../infrastructure/persistence/postgres/schema.js';\n`,
            domainPath,
        );
        expect(violations.length, 'expected a boundaries/dependencies error').toBeGreaterThan(0);
    });

    it('allows infrastructure layer to import domain', async () => {
        const violations = await lint(
            `import type { Entry } from '../domain/model/entry/entry.js';\n`,
            infraPath,
        );
        expect(violations, 'infra → domain should be allowed').toHaveLength(0);
    });
});

// ── Cross-context violations ───────────────────────────────────────────────

describe('cross-context boundary enforcement', () => {
    // A relative import that crosses into another context's source tree. The
    // target (src/iam/domain/user.ts) matches a `context-domain` element with a
    // different captured contextName, so it falls through to `default: 'disallow'`.
    it('blocks domain from importing another context via a relative path', async () => {
        const violations = await lint(
            `import type { User } from '../../iam/domain/model/user/user.js';\n`,
            domainPath,
        );
        expect(
            violations.length,
            'cross-context relative import from domain expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('blocks infrastructure from importing another context via a relative path', async () => {
        const violations = await lint(
            `import type { User } from '../../iam/domain/model/user/user.js';\n`,
            infraPath,
        );
        expect(
            violations.length,
            'cross-context relative import from infra expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('allows domain to import the shared kernel', async () => {
        const violations = await lint(
            `import type { ClubId } from '../../Shared/index.js';\n`,
            domainPath,
        );
        expect(violations, 'domain → kernel should be allowed').toHaveLength(0);
    });
});

// ── Interfaces layer (ADR-0021) ────────────────────────────────────────────

describe('interfaces layer boundary enforcement', () => {
    const interfacesPath = 'src/sample/interfaces/check.ts';

    it('blocks interfaces from importing infrastructure', async () => {
        const violations = await lint(
            `import { entriesTable } from '../infrastructure/persistence/postgres/schema.js';\n`,
            interfacesPath,
        );
        expect(
            violations.length,
            'interfaces → infrastructure must be blocked (ADR-0021: interfaces never imports infrastructure)',
        ).toBeGreaterThan(0);
    });

    it('allows interfaces to import same-context application', async () => {
        const violations = await lint(
            `import { SaveEntryUseCase } from '../application/save-entry/save-entry.js';\n`,
            interfacesPath,
        );
        expect(violations, 'interfaces → application should be allowed').toHaveLength(0);
    });

    it('allows interfaces to import the shared kernel', async () => {
        const violations = await lint(
            `import type { ClubId } from '../../Shared/index.js';\n`,
            interfacesPath,
        );
        expect(violations, 'interfaces → kernel should be allowed').toHaveLength(0);
    });
});
