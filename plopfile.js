// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

/** @param {import('plop').NodePlopAPI} plop */
export default function (plop) {
    plop.setHelper('eventContext', (value) => String(value).replaceAll('-', '').toLowerCase());

    plop.setGenerator('context', {
        description:
            'Scaffold a new bounded context (canonical directory-structure layout, ADR-0021)',
        prompts: [
            {
                type: 'input',
                name: 'name',
                message: 'Context name (kebab-case, e.g. my-context):',
                validate: (value) =>
                    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ||
                    'Must be kebab-case segments separated by single hyphens (e.g. my-context)',
            },
        ],
        actions: [
            {
                type: 'add',
                path: 'src/{{name}}/index.ts',
                templateFile: 'plop-templates/context/index.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/domain/model/item/item.ts',
                templateFile: 'plop-templates/context/domain/model/item/item.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/domain/model/item/events/item-saved.ts',
                templateFile: 'plop-templates/context/domain/model/item/events/item-saved.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/di/item-event-registry.ts',
                templateFile: 'plop-templates/context/infrastructure/di/item-event-registry.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/application/ports/unit-of-work.ts',
                templateFile: 'plop-templates/context/application/ports/unit-of-work.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/application/save-item/save-item.ts',
                templateFile: 'plop-templates/context/application/save-item/save-item.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/persistence/postgres/schema.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/schema.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/persistence/postgres/drizzle-item-repository.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/drizzle-item-repository.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/pg-unit-of-work.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/persistence/postgres/migrations/0000_bootstrap.sql',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/migrations/0000_bootstrap.sql.hbs',
            },
            {
                type: 'add',
                path: 'src/{{name}}/infrastructure/persistence/postgres/migrations/0001_outbox_poison_pill.sql',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/migrations/0001_outbox_poison_pill.sql.hbs',
            },
            {
                type: 'add',
                path: 'tests/{{name}}/__tests__/save-item.test.ts',
                templateFile: 'plop-templates/context/tests/__tests__/save-item.test.ts.hbs',
            },
            {
                type: 'add',
                path: 'tests/{{name}}/__tests__/outbox.integration.test.ts',
                templateFile:
                    'plop-templates/context/tests/__tests__/outbox.integration.test.ts.hbs',
            },
            // Format the generated TypeScript files so they pass `pnpm lint` immediately.
            function formatGeneratedFiles(answers) {
                const srcGlob = `src/${answers.name}/**/*.ts`;
                const testsGlob = `tests/${answers.name}/**/*.ts`;
                execSync(`pnpm exec prettier --write "${srcGlob}" "${testsGlob}"`, {
                    stdio: 'inherit',
                });
                return 'formatted generated files with Prettier';
            },
        ],
    });
}
