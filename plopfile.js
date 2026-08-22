// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

/** @param {import('plop').NodePlopAPI} plop */
export default function (plop) {
    plop.setHelper('eventContext', (value) => String(value).replaceAll('-', '').toLowerCase());

    plop.setGenerator('context', {
        description: 'Scaffold a new bounded-context package',
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
                path: 'packages/contexts/{{name}}/package.json',
                templateFile: 'plop-templates/context/package.json.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/tsconfig.json',
                templateFile: 'plop-templates/context/tsconfig.json.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/index.ts',
                templateFile: 'plop-templates/context/src/index.ts.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/domain/item.ts',
                templateFile: 'plop-templates/context/src/domain/item.ts.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/infrastructure/schema.ts',
                templateFile: 'plop-templates/context/src/infrastructure/schema.ts.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/infrastructure/drizzle-item-repository.ts',
                templateFile:
                    'plop-templates/context/src/infrastructure/drizzle-item-repository.ts.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/infrastructure/migrations/0000_bootstrap.sql',
                templateFile:
                    'plop-templates/context/src/infrastructure/migrations/0000_bootstrap.sql.hbs',
            },
            {
                type: 'add',
                path: 'packages/contexts/{{name}}/src/__tests__/outbox.integration.test.ts',
                templateFile: 'plop-templates/context/src/__tests__/outbox.integration.test.ts.hbs',
            },
            // Format the generated TypeScript and JSON files so they pass `pnpm lint` immediately.
            function formatGeneratedFiles(answers) {
                const glob = `packages/contexts/${answers.name}/src/**/*.ts`;
                const pkgJson = `packages/contexts/${answers.name}/package.json`;
                const tsConfig = `packages/contexts/${answers.name}/tsconfig.json`;
                execSync(`pnpm exec prettier --write "${glob}" "${pkgJson}" "${tsConfig}"`, {
                    stdio: 'inherit',
                });
                return 'formatted generated files with Prettier';
            },
        ],
    });
}
