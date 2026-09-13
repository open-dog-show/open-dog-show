// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regenerates `src/sample` / `tests/sample` from the `new:context` /
 * `new:aggregate` generators (ADR-0025): the reference sample is exactly the
 * generators' output, so this script is the single source both a developer
 * and CI run to prove that. CI (`pnpm regen:sample && git diff --exit-code --
 * src/sample tests/sample`) fails the build the moment a template change
 * would drift `sample` from its own generator.
 *
 * Every aggregate lists all four `new:aggregate` positional prompts (context,
 * name, scope, parent) explicitly, including an empty `parent` for non-hybrid
 * scopes: Plop's prompt-bypass mechanism fills prompts positionally and falls
 * back to an interactive prompt for any it runs out of values for, which
 * would hang a non-interactive CI run.
 */
const SAMPLE_AGGREGATES: ReadonlyArray<readonly [name: string, scope: string, parent: string]> = [
    ['item', 'club', ''],
    ['note', 'exhibitor', ''],
    ['ticket', 'hybrid', 'item'],
    ['announcement', 'platform', ''],
];

export function run(): void {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const rootDir = join(scriptDir, '..');

    rmSync(join(rootDir, 'src/sample'), { recursive: true, force: true });
    rmSync(join(rootDir, 'tests/sample'), { recursive: true, force: true });

    // Invokes Plop's bin script directly with `node` rather than through
    // `pnpm exec` — a package-manager shim (a `.cmd` wrapper on Windows) can
    // silently drop a trailing empty-string argument, which every non-hybrid
    // aggregate below relies on (see the module doc comment).
    const plopBin = join(rootDir, 'node_modules/plop/bin/plop.js');
    const plop = (args: readonly string[]): void => {
        execFileSync(process.execPath, [plopBin, ...args], {
            cwd: rootDir,
            stdio: 'inherit',
        });
    };

    plop(['context', 'sample']);
    for (const [name, scope, parent] of SAMPLE_AGGREGATES) {
        plop(['aggregate', 'sample', name, scope, parent]);
    }
}

// Only execute when run directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
