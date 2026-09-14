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

// Exact (trimmed) text of every `eslint-disable-next-line` comment new:context
// stamps into a bare skeleton to keep it lint-clean before any aggregate
// exists (empty interface/object types, unused imports/locals). Once real
// content lands next to one of these, the underlying rule no longer fires and
// the directive itself becomes an "unused eslint-disable directive" warning —
// so every new:aggregate run strips any of these lines still present,
// idempotently (a no-op once a prior aggregate already stripped them).
const SKELETON_DISABLE_COMMENTS = [
    '// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- populated by new:aggregate; empty only in a bare context skeleton',
    '// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by each Agg.Id below, appended by new:aggregate; unused only in a bare context skeleton',
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by new:aggregate's Handler instances; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by new:aggregate's registrations; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called by new:aggregate's repositories; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by new:aggregate's repository instances; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- uuid/text are used by new:aggregate's table definitions; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by new:aggregate's repositories; unused only in a bare context skeleton",
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by new:aggregate's ctx-field wiring; unused only in a bare context skeleton",
    "/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function -- staged/record are used by new:aggregate's repositories; unused only in a bare context skeleton */",
    '/* eslint-enable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */',
];

function stripSkeletonDisableComments(answers) {
    const files = [
        'application/ports/unit-of-work.ts',
        'domain/shared/domain-ids.ts',
        `infrastructure/di/create-${answers.context}-context.ts`,
        `infrastructure/messaging/${answers.context}-event-registry.ts`,
        `infrastructure/persistence/inmemory/fake-${answers.context}-unit-of-work.ts`,
        'infrastructure/persistence/postgres/pg-unit-of-work.ts',
        'infrastructure/persistence/postgres/schema.ts',
    ];
    let stripped = 0;
    for (const relPath of files) {
        const fullPath = path.join(process.cwd(), 'src', answers.context, relPath);
        if (!fs.existsSync(fullPath)) continue;
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
        const kept = lines.filter((line) => !SKELETON_DISABLE_COMMENTS.includes(line.trim()));
        if (kept.length !== lines.length) {
            stripped += lines.length - kept.length;
            fs.writeFileSync(fullPath, kept.join('\n'), 'utf8');
        }
    }
    return `stripped ${stripped} bare-skeleton eslint-disable comment(s) now that real content exists`;
}

/**
 * Finds `parent`'s create-table migration by its `new:aggregate`-assigned
 * filename (`NNNN_create_<parent>s_table.sql`).
 *
 * @returns the migration filename, or `undefined` when not found.
 */
function findMigrationFile(migrationsDir, parent) {
    const tableFileSuffix = `create_${parent.replaceAll('-', '_')}s_table.sql`;
    return fs.readdirSync(migrationsDir).find((f) => f.endsWith(tableFileSuffix));
}

/**
 * Whether a create-table migration's SQL carries the club-scope policy
 * marker (`_read ON`, unique to the club RLS template's read-open/
 * write-scoped policy split) rather than the `_hybrid`/`_exhibitor` markers
 * or platform's policy-free table.
 */
function isClubScoped(sql) {
    return sql.includes('_read ON');
}

/**
 * Validates that `parent` names an aggregate already generated in `context`,
 * and that it was generated with `--scope club` — the only scope a hybrid
 * aggregate may reference (ADR-0026).
 *
 * @returns an error message string when invalid, or `true` when valid.
 */
function validateHybridParent(context, parent) {
    const domainFile = path.join(
        process.cwd(),
        'src',
        context,
        'domain/model',
        parent,
        `${parent}.ts`,
    );
    if (!fs.existsSync(domainFile)) {
        return `No aggregate named '${parent}' in context '${context}' — generate it first (e.g. --scope club)`;
    }

    const migrationsDir = path.join(
        process.cwd(),
        'src',
        context,
        'infrastructure/persistence/postgres/migrations',
    );
    const migrationFile = findMigrationFile(migrationsDir, parent);
    if (migrationFile === undefined) {
        return `Could not find '${parent}'s migration in '${context}' — is it generated correctly?`;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
    if (!isClubScoped(sql)) {
        return `'${parent}' is not a club-scoped aggregate — a hybrid aggregate's parent must be`;
    }
    return true;
}

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

function registerHelpers(plop) {
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
}

// ── new:context — bounded-context skeleton (ADR-0025/0026/0027/0028) ────
// Stamps the unit-of-work port + its Postgres/in-memory implementations,
// the bootstrap/outbox migrations, the event registry, the
// create<Ctx>Context wiring factory, and a narrow index.ts. No aggregate
// is stamped here — that is new:aggregate's job.
const CONTEXT_ACTIONS = [
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
        templateFile: 'plop-templates/context/infrastructure/persistence/postgres/schema.ts.hbs',
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
        templateFile: 'plop-templates/context/infrastructure/messaging/event-registry.ts.hbs',
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
];

const AGG_DIR = 'plop-templates/aggregate';

function buildDomainActions(scope) {
    return [
        {
            type: 'add',
            path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}.ts',
            templateFile: `${AGG_DIR}/domain/aggregate-${scope}.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}-repository.ts',
            templateFile: `${AGG_DIR}/domain/aggregate-repository.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-created.ts',
            templateFile: `${AGG_DIR}/domain/events/created.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-renamed.ts',
            templateFile: `${AGG_DIR}/domain/events/renamed.ts.hbs`,
        },
    ];
}

function buildDomainIdsAction() {
    return {
        type: 'append',
        unique: false,
        path: 'src/{{dashCase context}}/domain/shared/domain-ids.ts',
        pattern: '// plop:ids',
        templateFile: `${AGG_DIR}/append/domain-ids.ts.hbs`,
    };
}

function buildApplicationActions(scope) {
    return [
        {
            type: 'add',
            path: 'src/{{dashCase context}}/application/create-{{dashCase name}}/create-{{dashCase name}}.ts',
            templateFile: `${AGG_DIR}/application/create-${scope}.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/application/rename-{{dashCase name}}/rename-{{dashCase name}}.ts',
            templateFile: `${AGG_DIR}/application/rename.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/application/ports/unit-of-work.ts',
            pattern: '// plop:imports',
            templateFile: `${AGG_DIR}/append/unit-of-work-import.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/application/ports/unit-of-work.ts',
            pattern: '// plop:repositories',
            templateFile: `${AGG_DIR}/append/unit-of-work-context.ts.hbs`,
        },
    ];
}

function buildPersistenceSrcActions(scope) {
    return [
        {
            type: 'add',
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/drizzle-{{dashCase name}}-repository.ts',
            templateFile: `${AGG_DIR}/infrastructure/drizzle-repository-${scope}.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/{{dashCase name}}-persistence-failed.ts',
            templateFile: `${AGG_DIR}/infrastructure/persistence-failed.ts.hbs`,
        },
        {
            type: 'add',
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/migrations/{{migrationSeq}}_create_{{plural (dashCase name)}}_table.sql',
            templateFile: `${AGG_DIR}/infrastructure/migrations/${scope}.sql.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/schema.ts',
            pattern: '// plop:tables',
            templateFile: `${AGG_DIR}/append/schema-table-${scope}.ts.hbs`,
        },
    ];
}

function buildPgUnitOfWorkActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
            pattern: '// plop:imports',
            templateFile: `${AGG_DIR}/append/pg-unit-of-work-import.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
            pattern: '// plop:repository-instances',
            templateFile: `${AGG_DIR}/append/pg-unit-of-work-instance.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/postgres/pg-unit-of-work.ts',
            pattern: '// plop:repositories',
            templateFile: `${AGG_DIR}/append/pg-unit-of-work-ctx-field.ts.hbs`,
        },
    ];
}

function buildFakeUnitOfWorkImportAndStateActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:imports',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-import.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:state',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-state.ts.hbs`,
        },
    ];
}

function buildFakeUnitOfWorkStagingActions(scope) {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:staging-methods',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-staging-${scope}.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:staging-init',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-staging-property.ts.hbs`,
        },
    ];
}

function buildFakeUnitOfWorkWiringActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:repositories',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-repo.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/persistence/inmemory/fake-{{dashCase context}}-unit-of-work.ts',
            pattern: '// plop:commit',
            templateFile: `${AGG_DIR}/append/fake-unit-of-work-commit.ts.hbs`,
        },
    ];
}

function buildMessagingActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/messaging/{{dashCase context}}-event-registry.ts',
            pattern: '// plop:imports',
            templateFile: `${AGG_DIR}/append/event-registry-import.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/messaging/{{dashCase context}}-event-registry.ts',
            pattern: '// plop:registrations',
            templateFile: `${AGG_DIR}/append/event-registry-registration.ts.hbs`,
        },
    ];
}

function buildDiActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
            pattern: '// plop:imports',
            templateFile: `${AGG_DIR}/append/create-context-import.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
            pattern: '// plop:usecases-type',
            templateFile: `${AGG_DIR}/append/create-context-usecases-type.ts.hbs`,
        },
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/infrastructure/di/create-{{dashCase context}}-context.ts',
            pattern: '// plop:usecases-instances',
            templateFile: `${AGG_DIR}/append/create-context-usecases-instance.ts.hbs`,
        },
    ];
}

function buildPublicSurfaceActions() {
    return [
        {
            type: 'append',
            unique: false,
            path: 'src/{{dashCase context}}/index.ts',
            pattern: '// plop:exports',
            templateFile: `${AGG_DIR}/append/index-export.ts.hbs`,
        },
    ];
}

function buildDomainTestActions(scope) {
    return [
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/{{dashCase name}}.test.ts',
            templateFile: `${AGG_DIR}/tests/aggregate-${scope}.test.ts.hbs`,
        },
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-created.test.ts',
            templateFile: `${AGG_DIR}/tests/events/created.test.ts.hbs`,
        },
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/domain/model/{{dashCase name}}/events/{{dashCase name}}-renamed.test.ts',
            templateFile: `${AGG_DIR}/tests/events/renamed.test.ts.hbs`,
        },
    ];
}

function buildApplicationTestActions(scope) {
    return [
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/application/create-{{dashCase name}}/create-{{dashCase name}}.test.ts',
            templateFile: `${AGG_DIR}/tests/create-${scope}.test.ts.hbs`,
        },
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/application/rename-{{dashCase name}}/rename-{{dashCase name}}.test.ts',
            templateFile: `${AGG_DIR}/tests/rename-${scope}.test.ts.hbs`,
        },
        {
            type: 'add',
            path: 'tests/{{dashCase context}}/infrastructure/persistence/postgres/{{dashCase name}}-rls.integration.test.ts',
            templateFile: `${AGG_DIR}/tests/rls-${scope}.integration.test.ts.hbs`,
        },
    ];
}

// Composes the full new:aggregate action list from the per-area builders
// above — kept as one small function so the overall sequence (domain →
// application → infrastructure → public surface → tests → cleanup) stays
// visible in one place, without any single function growing past the
// structural line limit.
function buildAggregateActions(scope) {
    return [
        computeMigrationSeq,
        ...buildDomainActions(scope),
        buildDomainIdsAction(),
        ...buildApplicationActions(scope),
        ...buildPersistenceSrcActions(scope),
        ...buildPgUnitOfWorkActions(),
        ...buildFakeUnitOfWorkImportAndStateActions(),
        ...buildFakeUnitOfWorkStagingActions(scope),
        ...buildFakeUnitOfWorkWiringActions(),
        ...buildMessagingActions(),
        ...buildDiActions(),
        ...buildPublicSurfaceActions(),
        ...buildDomainTestActions(scope),
        ...buildApplicationTestActions(scope),
        stripSkeletonDisableComments,
        formatGeneratedFiles,
    ];
}

const CONTEXT_PROMPTS = [
    {
        type: 'input',
        name: 'name',
        message: 'Context name (kebab-case, e.g. my-context):',
        validate: kebabValidator,
    },
];

// Not a conditional (`when`) prompt so `parent` stays bypassable positionally
// (`pnpm new:aggregate <ctx> <name> hybrid <parent>`, matching the
// smoke-tested non-interactive CI usage) — plop refuses to bypass any prompt
// that carries a `when` function. Only required/validated when scope is
// actually 'hybrid'.
function validateParentPrompt(value, answers) {
    if (answers?.scope !== 'hybrid') return true;
    const kebabResult = kebabValidator(value);
    if (kebabResult !== true) return kebabResult;
    return validateHybridParent(answers.context, value);
}

const AGGREGATE_PROMPTS = [
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
        validate: (value) => SCOPES.includes(value) || `Must be one of: ${SCOPES.join(', ')}`,
    },
    {
        type: 'input',
        name: 'parent',
        message:
            'Parent aggregate name (an existing club-scoped aggregate in this context; only used when scope is hybrid):',
        validate: validateParentPrompt,
    },
];

/** @param {import('plop').NodePlopAPI} plop */
export default function (plop) {
    registerHelpers(plop);

    plop.setGenerator('context', {
        description:
            'Scaffold a new bounded context skeleton (no aggregate) — ADR-0025/0026/0027/0028',
        prompts: CONTEXT_PROMPTS,
        actions: CONTEXT_ACTIONS,
    });

    // ── new:aggregate — one aggregate, one ADR-0005 ownership scope ─────────
    plop.setGenerator('aggregate', {
        description:
            'Scaffold an aggregate (class root, repository, create/rename use cases, RLS-scoped table + tests) into an existing context — ADR-0026/0027',
        prompts: AGGREGATE_PROMPTS,
        actions: (data) => buildAggregateActions(data.scope),
    });
}
