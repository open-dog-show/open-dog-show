// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import boundaries from 'eslint-plugin-boundaries';

// Shared allow clause: @ods/kernel is importable from any context layer.
const allowKernel = { to: { module: { origin: 'external', source: '@ods/kernel' } } };

export default tseslint.config(
    { ignores: ['**/node_modules/**', '**/dist/**'] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: { unicorn },
        rules: {
            'unicorn/filename-case': ['error', { case: 'kebabCase', checkDirectories: false }],
        },
    },
    // ── ADR-0006 boundary rules ──────────────────────────────────────────────
    // Layer taxonomy (inward-only) and context-zone taxonomy (@ods/* isolation)
    // applied to all context source files.
    {
        files: ['packages/contexts/*/src/**/*.ts'],
        plugins: { boundaries },
        settings: {
            // Flag all @ods/* workspace packages as "external" so the
            // module.origin selector in policies can distinguish them from
            // local relative imports without needing full resolver resolution.
            'boundaries/flag-as-external': {
                customSourcePatterns: ['@ods/*'],
            },
            // Layer taxonomy: the three clean-architecture layers inside every
            // bounded context. `capture` extracts the context name from the
            // path wildcard so same-context constraints can be expressed in
            // policies (preventing cross-context imports via relative paths).
            'boundaries/elements': [
                {
                    type: 'context-domain',
                    pattern: 'packages/contexts/*/src/domain/**',
                    capture: ['contextName'],
                },
                {
                    type: 'context-application',
                    pattern: 'packages/contexts/*/src/application/**',
                    capture: ['contextName'],
                },
                {
                    type: 'context-infrastructure',
                    pattern: 'packages/contexts/*/src/infrastructure/**',
                    capture: ['contextName'],
                },
            ],
            // The public surface (index.ts) is a single file, so it is
            // classified with a file descriptor rather than an element descriptor.
            // `capture` extracts the context name for same-context constraints.
            'boundaries/files': [
                {
                    category: 'context-index',
                    pattern: 'packages/contexts/*/src/index.ts',
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
                    // Check both local (relative) and external (@ods/*) imports.
                    checkAllOrigins: true,
                    policies: [
                        // ── context-domain ────────────────────────────────────
                        // Pure domain: @ods/kernel and same-context domain
                        // siblings are permitted; no ORM, no other contexts,
                        // no infrastructure references.
                        {
                            from: { element: { type: 'context-domain' } },
                            allow: [
                                allowKernel,
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
                            // ADR-0013: the kernel owns the context-neutral `PrincipalId`;
                            // `@ods/iam` owns `UserId`. A downstream context domain layer must
                            // not import IAM's `UserId` (or the removed `ExhibitorId` brand)
                            // from the kernel. The specifier-level `disallow` takes precedence
                            // over `allowKernel`, so the rest of `@ods/kernel` (`PrincipalId`,
                            // `ClubId`, …) stays importable while the IAM-owned identifiers are
                            // rejected at the boundary.
                            disallow: [
                                {
                                    to: {
                                        module: { origin: 'external', source: '@ods/kernel' },
                                    },
                                    dependency: {
                                        specifiers: [
                                            'UserId',
                                            'asUserId',
                                            'ExhibitorId',
                                            'asExhibitorId',
                                        ],
                                    },
                                },
                            ],
                        },
                        // ── context-application ───────────────────────────────
                        // Use-cases: may depend on same-context domain layer
                        // and @ods/kernel.
                        {
                            from: { element: { type: 'context-application' } },
                            allow: [
                                allowKernel,
                                {
                                    to: {
                                        element: {
                                            type: 'context-domain',
                                            // Same-context constraint: application in context A
                                            // may only import domain from context A.
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
                        // layers, @ods/kernel, the Drizzle ORM, and the pg driver.
                        // Payments/Identity must be accessed through an ACL
                        // adapter here — no other @ods context is permitted.
                        {
                            from: { element: { type: 'context-infrastructure' } },
                            allow: [
                                allowKernel,
                                {
                                    to: {
                                        element: {
                                            type: ['context-domain', 'context-application'],
                                            // Same-context constraint: infra in context A
                                            // may only import domain/application from context A.
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
                        // ── context-index ─────────────────────────────────────
                        // Public surface (index.ts): re-exports from same-context
                        // layers plus kernel. Uses the file-category dimension
                        // because index.ts is a single file, not a folder element.
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
                                            ],
                                            // Same-context constraint: index.ts from context A
                                            // may only re-export from context A's own layers.
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
