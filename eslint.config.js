// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import boundaries from 'eslint-plugin-boundaries';

// Shared allow clause: the shared kernel (src/Shared/**) is importable from any
// context layer. ADR-0020 replaced the @ods/kernel package import with a
// relative path to the kernel barrel; the kernel is now a path-classified
// element rather than an external module source.
const allowKernel = { to: { element: { type: 'kernel' } } };

// ADR-0028: rulesets' barrel is importable by any layer; iam's barrel is
// importable only by infrastructure. See ADR-0028 for the rationale and the
// full list of allowed edges. Targets the `context-index` file category
// (index.ts is a single file, not a folder element) with a literal captured
// `contextName`, so each clause matches that one context's barrel regardless
// of which context is importing; deep imports into rulesets/iam internals
// are not covered and stay disallowed.
const allowContextIndex = (contextName) => ({
    to: { file: { categories: 'context-index', captured: { contextName } } },
});
const allowRulesetsIndex = allowContextIndex('rulesets');
const allowIamIndex = allowContextIndex('iam');

export default tseslint.config(
    // .claude/ is gitignored local tooling (not part of the repo's source
    // tree) — outside this config's lint scope.
    { ignores: ['**/node_modules/**', '**/dist/**', 'coverage/**', '.claude/**'] },
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        // Type-checked linting uses the project service, which resolves the
        // nearest tsconfig for each linted file. `allowDefaultProject` covers
        // the synthetic, never-on-disk `check.ts` paths
        // `scripts/__tests__/boundary-lint.test.ts` feeds to a nested ESLint
        // instance (via `eslint.lintText`) to probe `boundaries/dependencies`
        // — without it the project service can't find a tsconfig for a path
        // that doesn't exist and fails the parse, silently zeroing out every
        // violation the test expects.
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        'src/sample/domain/check.ts',
                        'src/sample/application/check.ts',
                        'src/sample/infrastructure/check.ts',
                        'src/sample/interfaces/check.ts',
                        'src/rulesets/domain/check.ts',
                        'src/iam/domain/check.ts',
                    ],
                },
            },
        },
        plugins: { unicorn },
        // Deterministic Clean Code structural limits — the size/shape
        // heuristics a tool can judge. Naming honesty and one-thing-ness stay
        // with the instruction and review layers.
        rules: {
            'unicorn/filename-case': ['error', { case: 'kebabCase', checkDirectories: false }],
            'max-params': ['error', 3],
            complexity: ['error', 10],
            'max-depth': ['error', 3],
            'max-lines-per-function': [
                'error',
                { max: 30, skipBlankLines: true, skipComments: true },
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                { selector: 'variableLike', format: ['camelCase', 'UPPER_CASE'] },
                { selector: 'typeLike', format: ['PascalCase'] },
                // Idiomatic TS marks an intentionally-unused binding with a
                // leading underscore (type-level "must not compile" probes,
                // unused callback params). Scoped to parameter/variable only —
                // functions and types still require the format above.
                {
                    selector: ['parameter', 'variable'],
                    format: ['camelCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow',
                },
            ],
        },
    },
    // Test bodies commonly exceed 30 lines for arrange/act/assert clarity;
    // every other structural limit still applies inside tests.
    {
        files: ['tests/**'],
        rules: {
            'max-lines-per-function': 'off',
        },
    },
    // plopfile.js is a plain Node script (not a .ts file, so it doesn't get
    // typescript-eslint's no-undef exemption for ambient Node globals) — its
    // custom migration-sequencing action reads the filesystem via `process.cwd()`.
    {
        files: ['plopfile.js'],
        languageOptions: {
            globals: { process: 'readonly' },
        },
    },
    // Tooling files outside tsconfig's `include` (root config files and plain
    // JS) have no project for the project service; lint them without
    // type information.
    {
        files: ['**/*.{js,mjs,cjs}', 'vitest.config.ts', 'vitest.integration.config.ts'],
        ...tseslint.configs.disableTypeChecked,
    },
    // ── ADR-0006 / ADR-0020 / ADR-0021 boundary rules ────────────────────────
    // Layer taxonomy (inward-only) and context-zone taxonomy (no cross-context
    // imports) applied to context source files. Contexts live directly under
    // src/<name>/ (ADR-0020/0021); the shared kernel (src/Shared/**) is ignored
    // so the rule runs on context files only. The four layers (domain,
    // application, infrastructure, interfaces) follow ADR-0021; `interfaces/`
    // is enforced from the moment delivery code lands.
    {
        files: ['src/**/*.ts'],
        ignores: ['src/Shared/**'],
        plugins: { boundaries },
        settings: {
            // Layer taxonomy: the three clean-architecture layers inside every
            // bounded context, plus the shared kernel. `capture` extracts the
            // context name from the path wildcard so same-context constraints
            // can be expressed in policies (preventing cross-context imports
            // via relative paths: an import to a different context's folder
            // matches a context-* element with a different captured
            // contextName and falls through to `default: 'disallow'`).
            'boundaries/elements': [
                {
                    type: 'kernel',
                    pattern: 'src/Shared/**',
                },
                {
                    type: 'context-domain',
                    pattern: 'src/*/domain/**',
                    capture: ['contextName'],
                },
                {
                    type: 'context-application',
                    pattern: 'src/*/application/**',
                    capture: ['contextName'],
                },
                {
                    type: 'context-infrastructure',
                    pattern: 'src/*/infrastructure/**',
                    capture: ['contextName'],
                },
                {
                    type: 'context-interfaces',
                    pattern: 'src/*/interfaces/**',
                    capture: ['contextName'],
                },
            ],
            // The public surface (index.ts) is a single file, so it is
            // classified with a file descriptor rather than an element descriptor.
            'boundaries/files': [
                {
                    category: 'context-index',
                    pattern: 'src/*/index.ts',
                    capture: ['contextName'],
                },
            ],
            // eslint-import-resolver-typescript maps .js extensions back to
            // .ts source files so relative imports are resolved correctly.
            'import/resolver': {
                typescript: { alwaysTryTypes: true },
            },
        },
        rules: {
            'boundaries/dependencies': [
                'error',
                {
                    // Default to deny; each layer's allowed dependencies are
                    // listed explicitly below.
                    default: 'disallow',
                    // Check both local (relative) and external (drizzle/pg) imports.
                    checkAllOrigins: true,
                    policies: [
                        // ── context-domain ────────────────────────────────────
                        // Pure domain: the shared kernel and same-context domain
                        // siblings are permitted; no ORM, no other contexts, no
                        // infrastructure references.
                        //
                        // ADR-0013 / ADR-0020: the kernel owns `PrincipalId`;
                        // `UserId` is owned by IAM. The specifier-level `disallow`
                        // that blocked importing `UserId`/`asUserId`/`ExhibitorId`/
                        // `asExhibitorId` from `@ods/kernel` is removed — it was
                        // keyed on the `@ods/kernel` module source, which no
                        // longer exists. The invariant now holds because the
                        // kernel barrel does not export those symbols (a `tsc`
                        // error) and the cross-context ban blocks importing them
                        // from IAM directly.
                        {
                            from: { element: { type: 'context-domain' } },
                            allow: [
                                allowKernel,
                                allowRulesetsIndex,
                                {
                                    to: {
                                        element: {
                                            type: 'context-domain',
                                            captured: {
                                                contextName:
                                                    '{{ from.element.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                        // ── context-application ───────────────────────────────
                        // Use-cases: may depend on same-context domain layer
                        // and the shared kernel.
                        {
                            from: { element: { type: 'context-application' } },
                            allow: [
                                allowKernel,
                                allowRulesetsIndex,
                                {
                                    to: {
                                        element: {
                                            type: 'context-domain',
                                            captured: {
                                                contextName:
                                                    '{{ from.element.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                        // ── context-infrastructure ────────────────────────────
                        // Adapters: may import same-context domain and application
                        // layers, the shared kernel, the Drizzle ORM, and the pg
                        // driver. No other context is permitted; Payments/Identity
                        // must be accessed through an ACL adapter here.
                        {
                            from: { element: { type: 'context-infrastructure' } },
                            allow: [
                                allowKernel,
                                allowRulesetsIndex,
                                allowIamIndex,
                                {
                                    to: {
                                        element: {
                                            type: ['context-domain', 'context-application'],
                                            captured: {
                                                contextName:
                                                    '{{ from.element.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                                // Intra-infrastructure sibling imports (same context only,
                                // e.g. drizzle-entry-repository.ts → schema.ts)
                                {
                                    to: {
                                        element: {
                                            type: 'context-infrastructure',
                                            captured: {
                                                contextName:
                                                    '{{ from.element.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                                {
                                    to: {
                                        module: { origin: 'external', source: 'drizzle-orm' },
                                    },
                                },
                                {
                                    to: {
                                        module: {
                                            origin: 'external',
                                            source: 'drizzle-orm/*',
                                        },
                                    },
                                },
                                {
                                    to: { module: { origin: 'external', source: 'pg' } },
                                },
                                // Node.js built-ins (node:crypto etc.)
                                { to: { module: { origin: 'core' } } },
                            ],
                        },
                        // ── context-interfaces ──────────────────────────────────
                        // Delivery layer (http/cli/events). Imports same-context
                        // domain and application, plus the shared kernel — never
                        // infrastructure (ADR-0004/0006/0021). Add the web framework
                        // to the allow list here when delivery code lands.
                        {
                            from: { element: { type: 'context-interfaces' } },
                            allow: [
                                allowKernel,
                                allowRulesetsIndex,
                                {
                                    to: {
                                        element: {
                                            type: ['context-domain', 'context-application'],
                                            captured: {
                                                contextName:
                                                    '{{ from.element.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                                // Node.js built-ins
                                { to: { module: { origin: 'core' } } },
                            ],
                        },
                        // ── context-index ─────────────────────────────────────
                        // Public surface (index.ts): re-exports from same-context
                        // layers plus the shared kernel. Uses the file-category
                        // dimension because index.ts is a single file, not a
                        // folder element.
                        {
                            from: { file: { categories: 'context-index' } },
                            allow: [
                                allowKernel,
                                {
                                    to: {
                                        element: {
                                            type: [
                                                'context-domain',
                                                'context-application',
                                                'context-infrastructure',
                                                'context-interfaces',
                                            ],
                                            captured: {
                                                contextName: '{{ from.file.captured.contextName }}',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    },
    prettierConfig,
);
