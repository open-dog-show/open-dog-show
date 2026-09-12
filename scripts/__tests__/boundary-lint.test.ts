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

// ── ADR-0028: rulesets Published Language and IAM ACL ──────────────────────

describe('ADR-0028 cross-context index allowances', () => {
    const applicationPath = 'src/sample/application/check.ts';
    const interfacesPath = 'src/sample/interfaces/check.ts';

    it('allows domain to import the rulesets barrel', async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../rulesets/index.js';\n`,
            domainPath,
        );
        expect(violations, 'domain → rulesets index should be allowed').toHaveLength(0);
    });

    it('blocks domain from a deep import into rulesets internals', async () => {
        const violations = await lint(
            `import { resolveEffectiveRuleset } from '../../rulesets/domain/service/resolve-effective-ruleset.js';\n`,
            domainPath,
        );
        expect(
            violations.length,
            'domain → rulesets deep path expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('allows application to import the rulesets barrel', async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../rulesets/index.js';\n`,
            applicationPath,
        );
        expect(violations, 'application → rulesets index should be allowed').toHaveLength(0);
    });

    it('allows interfaces to import the rulesets barrel', async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../rulesets/index.js';\n`,
            interfacesPath,
        );
        expect(violations, 'interfaces → rulesets index should be allowed').toHaveLength(0);
    });

    it('allows infrastructure to import the rulesets barrel', async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../rulesets/index.js';\n`,
            infraPath,
        );
        expect(violations, 'infrastructure → rulesets index should be allowed').toHaveLength(0);
    });

    it('allows a different context (not sample) to import the rulesets barrel', async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../rulesets/index.js';\n`,
            'src/iam/domain/check.ts',
        );
        expect(violations, 'iam domain → rulesets index should be allowed').toHaveLength(0);
    });

    it('allows infrastructure to import the IAM barrel', async () => {
        const violations = await lint(
            `import type { IdentitySnapshot } from '../../iam/index.js';\n`,
            infraPath,
        );
        expect(violations, 'infrastructure → iam index should be allowed').toHaveLength(0);
    });

    it('blocks domain from importing the IAM barrel', async () => {
        const violations = await lint(
            `import type { IdentitySnapshot } from '../../iam/index.js';\n`,
            domainPath,
        );
        expect(
            violations.length,
            'domain → iam index expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('blocks application from importing the IAM barrel', async () => {
        const violations = await lint(
            `import type { IdentitySnapshot } from '../../iam/index.js';\n`,
            applicationPath,
        );
        expect(
            violations.length,
            'application → iam index expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('blocks interfaces from importing the IAM barrel', async () => {
        const violations = await lint(
            `import type { IdentitySnapshot } from '../../iam/index.js';\n`,
            interfacesPath,
        );
        expect(
            violations.length,
            'interfaces → iam index expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it('blocks infrastructure from a deep import into iam internals', async () => {
        const violations = await lint(
            `import type { User } from '../../iam/domain/model/user/user.js';\n`,
            infraPath,
        );
        expect(
            violations.length,
            'infrastructure → iam deep path expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
    });

    it("blocks any context from importing another context's index (not rulesets/iam)", async () => {
        const violations = await lint(
            `import type { RulesetId } from '../../sample/index.js';\n`,
            'src/rulesets/domain/check.ts',
        );
        expect(
            violations.length,
            'cross-context index import (not rulesets/iam) expected a boundaries/dependencies error',
        ).toBeGreaterThan(0);
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
