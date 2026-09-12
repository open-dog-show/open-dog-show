// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SCOPES = ['club', 'exhibitor', 'hybrid', 'platform'];

const kebabValidator = (value) =>
    KEBAB_CASE.test(value) ||
    'Must be kebab-case segments separated by single hyphens (e.g. my-context)';

/**
 * Computes the next 4-digit migration sequence number for a context by
 * scanning its existing migration filenames (`NNNN_*.sql`) and picks the
 * highest `NNNN` prefix + 1. Runs as a custom function action so later
 * actions in the same `new:aggregate` invocation can reference
 * `{{migrationSeq}}` in their `path`.
 */
function computeMigrationSeq(answers) {
    const dir = path.join(
        process.cwd(),
        'src',
        answers.context,
        'infrastructure/persistence/postgres/migrations',
    );
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')) : [];
    const max = files.reduce((acc, f) => {
        const n = Number.parseInt(f.slice(0, 4), 10);
        return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, -1);
    answers.migrationSeq = String(max + 1).padStart(4, '0');
    return `next migration sequence for '${answers.context}': ${answers.migrationSeq}`;
}

/** @param {import('plop').NodePlopAPI} plop */
export default function (plop) {
    plop.setHelper('eventContext', (value) => String(value).replaceAll('-', '').toLowerCase());
    // Naive English pluraliser — every placeholder/real aggregate name used
    // with this generator is a regular singular noun (item, note, ticket,
    // announcement, …), so a bare `+s` is sufficient; it is not meant to
    // handle irregular plurals.
    plop.setHelper('plural', (value) => `${value}s`);
    // Indefinite article agreement for generated prose (`{{a (pascalCase name)}} {{pascalCase name}}`
    // reads "an Item" / "a Ticket"), based on the first-letter sound only —
    // matches every current/likely aggregate name (no silent-consonant nouns).
    const indefiniteArticle = (word) => (/^[aeiouAEIOU]/.test(String(word)) ? 'an' : 'a');
    plop.setHelper('a', indefiniteArticle);
    plop.setHelper('A', (word) => {
        const article = indefiniteArticle(word);
        return article.charAt(0).toUpperCase() + article.slice(1);
    });

    // ── new:context — bounded-context skeleton (ADR-0025/0026/0027/0028) ────
    // Stamps the unit-of-work port + its Postgres/in-memory implementations,
    // the bootstrap/outbox migrations, the event registry, the
    // create<Ctx>Context wiring factory, and a narrow index.ts. No aggregate
    // is stamped here — that is new:aggregate's job.
    plop.setGenerator('context', {
        description:
            'Scaffold a new bounded context skeleton (no aggregate) — ADR-0025/0026/0027/0028',
        prompts: [
            {
                type: 'input',
                name: 'name',
                message: 'Context name (kebab-case, e.g. my-context):',
                validate: kebabValidator,
            },
        ],
        actions: [
            {
                type: 'add',
                path: 'src/{{dashCase name}}/index.ts',
                templateFile: 'plop-templates/context/index.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/domain/shared/domain-ids.ts',
                templateFile: 'plop-templates/context/domain/shared/domain-ids.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/application/ports/unit-of-work.ts',
                templateFile: 'plop-templates/context/application/ports/unit-of-work.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/persistence/postgres/schema.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/schema.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/pg-unit-of-work.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/persistence/inmemory/fake-{{dashCase name}}-unit-of-work.ts',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/inmemory/fake-unit-of-work.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/messaging/{{dashCase name}}-event-registry.ts',
                templateFile:
                    'plop-templates/context/infrastructure/messaging/event-registry.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/di/create-{{dashCase name}}-context.ts',
                templateFile: 'plop-templates/context/infrastructure/di/create-context.ts.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/persistence/postgres/migrations/0000_bootstrap.sql',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/migrations/0000_bootstrap.sql.hbs',
            },
            {
                type: 'add',
                path: 'src/{{dashCase name}}/infrastructure/persistence/postgres/migrations/0001_outbox_poison_pill.sql',
                templateFile:
                    'plop-templates/context/infrastructure/persistence/postgres/migrations/0001_outbox_poison_pill.sql.hbs',
            },
            {
                type: 'add',
                path: 'tests/{{dashCase name}}/fixtures.ts',
                templateFile: 'plop-templates/context/tests/fixtures.ts.hbs',
            },
            {
                type: 'add',
                path: 'tests/{{dashCase name}}/infrastructure/persistence/postgres/outbox.integration.test.ts',
                templateFile: 'plop-templates/context/tests/outbox.integration.test.ts.hbs',
            },
            formatGeneratedFiles,
        ],
    });

    // ── new:aggregate — one aggregate, one ADR-0005 ownership scope ─────────
    plop.setGenerator('aggregate', {
        description:
            'Scaffold an aggregate (class root, repository, create/rename use cases, RLS-scoped table + tests) into an existing context — ADR-0026/0027',
        prompts: [
            {
                type: 'input',
                name: 'context',
                message: 'Context name (must already exist, e.g. sample):',
                validate: kebabValidator,
            },
            {
                type: 'input',
                name: 'name',
                message: 'Aggregate name (kebab-case singular noun, e.g. item):',
                validate: kebabValidator,
            },
            {
                type: 'input',
                name: 'scope',
                message: `Ownership scope (${SCOPES.join('|')}):`,
                validate: (value) =>
                    SCOPES.includes(value) || `Must be one of: ${SCOPES.join(', ')}`,
            },
            {
                type: 'input',
                name: 'parent',
                message:
                    'Parent aggregate name (an existing club-scoped aggregate in this context; only used when scope is hybrid):',
                // Not a conditional (`when`) prompt so it stays bypassable
                // positionally (`pnpm new:aggregate <ctx> <name> hybrid <parent>`,
                // matching the smoke-tested non-interactive CI usage) — plop
                // refuses to bypass any prompt that carries a `when` function.
                // Only required/validated when scope is actually 'hybrid'.
                validate: (value, answers) => answers?.scope !== 'hybrid' || kebabValidator(value),
            },
        ],
        actions(data) {
            const scope = data.scope;
            const aggDir = 'plop-templates/aggregate';

            const actions = [
                computeMigrationSeq,

                // ── domain ───────────────────────────────────────────────
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}.ts',
                    templateFile: `${aggDir}/domain/aggregate-${scope}.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}-repository.ts',
                    templateFile: `${aggDir}/domain/aggregate-repository.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-created.ts',
                    templateFile: `${aggDir}/domain/events/created.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-renamed.ts',
                    templateFile: `${aggDir}/domain/events/renamed.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/domain/shared/domain-ids.ts',
                    pattern: '// plop:ids',
                    templateFile: `${aggDir}/append/domain-ids.ts.hbs`,
                },

                // ── application ──────────────────────────────────────────
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/application/create-{{dashCase name}}/create-{{dashCase name}}.ts',
                    templateFile: `${aggDir}/application/create-${scope}.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/application/rename-{{dashCase name}}/rename-{{dashCase name}}.ts',
                    templateFile: `${aggDir}/application/rename.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/application/ports/unit-of-work.ts',
                    pattern: '// plop:imports',
                    templateFile: `${aggDir}/append/unit-of-work-import.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/application/ports/unit-of-work.ts',
                    pattern: '// plop:repositories',
                    templateFile: `${aggDir}/append/unit-of-work-context.ts.hbs`,
                },

                // ── infrastructure: persistence ──────────────────────────
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/drizzle-{{dashCase name}}-repository.ts',
                    templateFile: `${aggDir}/infrastructure/drizzle-repository-${scope}.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/{{dashCase name}}-persistence-failed.ts',
                    templateFile: `${aggDir}/infrastructure/persistence-failed.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/migrations/{{migrationSeq}}_create_{{plural (dashCase name)}}_table.sql',
                    templateFile: `${aggDir}/infrastructure/migrations/${scope}.sql.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/schema.ts',
                    pattern: '// plop:tables',
                    templateFile: `${aggDir}/append/schema-table-${scope}.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
                    pattern: '// plop:imports',
                    templateFile: `${aggDir}/append/pg-unit-of-work-import.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
                    pattern: '// plop:repository-instances',
                    templateFile: `${aggDir}/append/pg-unit-of-work-instance.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
                    pattern: '// plop:repositories',
                    templateFile: `${aggDir}/append/pg-unit-of-work-ctx-field.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
                    pattern: '// plop:imports',
                    templateFile: `${aggDir}/append/fake-unit-of-work-import.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
                    pattern: '// plop:state',
                    templateFile: `${aggDir}/append/fake-unit-of-work-state.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
                    pattern: '// plop:staging-init',
                    templateFile: `${aggDir}/append/fake-unit-of-work-staging.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
                    pattern: '// plop:repositories',
                    templateFile: `${aggDir}/append/fake-unit-of-work-repo.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
                    pattern: '// plop:commit',
                    templateFile: `${aggDir}/append/fake-unit-of-work-commit.ts.hbs`,
                },

                // ── infrastructure: messaging + di ───────────────────────
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/messaging/{{dashCase context}}-event-registry.ts',
                    pattern: '// plop:imports',
                    templateFile: `${aggDir}/append/event-registry-import.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/messaging/{{dashCase context}}-event-registry.ts',
                    pattern: '// plop:registrations',
                    templateFile: `${aggDir}/append/event-registry-registration.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
                    pattern: '// plop:imports',
                    templateFile: `${aggDir}/append/create-context-import.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
                    pattern: '// plop:usecases-type',
                    templateFile: `${aggDir}/append/create-context-usecases-type.ts.hbs`,
                },
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
                    pattern: '// plop:usecases-instances',
                    templateFile: `${aggDir}/append/create-context-usecases-instance.ts.hbs`,
                },

                // ── public surface ───────────────────────────────────────
                {
                    type: 'append',
                    unique: false,
                    path: 'src/{{dashCase context}}/index.ts',
                    pattern: '// plop:exports',
                    templateFile: `${aggDir}/append/index-export.ts.hbs`,
                },

                // ── tests (mirrors src/, no __tests__/) ──────────────────
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}.test.ts',
                    templateFile: `${aggDir}/tests/aggregate-${scope}.test.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-created.test.ts',
                    templateFile: `${aggDir}/tests/events/created.test.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-renamed.test.ts',
                    templateFile: `${aggDir}/tests/events/renamed.test.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/application/create-{{dashCase name}}/create-{{dashCase name}}.test.ts',
                    templateFile: `${aggDir}/tests/create-${scope}.test.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/application/rename-{{dashCase name}}/rename-{{dashCase name}}.test.ts',
                    templateFile: `${aggDir}/tests/rename-${scope}.test.ts.hbs`,
                },
                {
                    type: 'add',
                    path: 'tests/{{dashCase context}}/infrastructure/persistence/postgres/{{dashCase name}}-rls.integration.test.ts',
                    templateFile: `${aggDir}/tests/rls-${scope}.integration.test.ts.hbs`,
                },

                formatGeneratedFiles,
            ];

            return actions;
        },
    });

    // Format the generated/appended TypeScript files so they pass `pnpm lint` immediately.
    function formatGeneratedFiles(answers) {
        const context = answers.context ?? answers.name;
        const srcGlob = `src/${context}/**/*.ts`;
        const testsGlob = `tests/${context}/**/*.ts`;
        execSync(`pnpm exec prettier --write "${srcGlob}" "${testsGlob}"`, {
            stdio: 'inherit',
        });
        return 'formatted generated files with Prettier';
    }
}
