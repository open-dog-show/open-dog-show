<!-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# TypeScript File Naming Conventions: Primary-Source Research

## Executive Summary

**Recommendation: adopt kebab-case uniformly across the entire monorepo.**
Every authoritative TypeScript-ecosystem style guide that takes a position on file naming — Angular, Google TypeScript Style Guide, and eslint-plugin-unicorn — converges on all-lowercase hyphenated names. The Microsoft TypeScript Coding Guidelines apply only to the compiler codebase and are explicitly scoped "NOT a prescriptive guideline for the TypeScript community"; the TypeScript Handbook is silent. Node.js core uses all-lowercase snake_case. NestJS uses kebab-case throughout its generator and documented examples. PascalCase looks natural for single-class files but breaks down for multi-export utility modules (`ids.ts`, `codec.ts`, `ports.ts`) and — critically — creates a real risk of case-sensitivity collisions when the same monorepo is developed on Windows and CI runs on Linux. The current mixed state (PascalCase in `infrastructure/` and `testing/`, kebab-case in `domain/`) should be resolved by migrating toward kebab-case everywhere. Enforcement is trivial: `eslint-plugin-unicorn`'s `filename-case` rule with `{ case: 'kebabCase' }` is a single-line config and covers both `.ts` filenames and directory names.

---

## 1. TypeScript Handbook — Modules

**Source:** <https://www.typescriptlang.org/docs/handbook/2/modules.html>

**What it says:** Silent on file naming conventions. The handbook does not contain any rule or recommendation for how source files should be named.

**Observed practice in examples:** The handbook uses all-lowercase names in every code sample — `hello.ts`, `maths.ts`, `animal.ts`, `app.ts`, `constants.js` — but this is never stated as a rule; it is just the style used by handbook authors.

**Rationale given:** None. The handbook focuses exclusively on module semantics, import/export syntax, module resolution, and module output options. File naming is out of scope.

**Verdict for this project:** No guidance to extract. Cannot cite this as authority for either convention.

---

## 2. Microsoft TypeScript Coding Guidelines

**Source:** <https://github.com/microsoft/TypeScript/wiki/Coding-guidelines>

**What it says:** The page opens with a large warning:

> **"These are Coding Guidelines for Contributors to TypeScript. This is NOT a prescriptive guideline for the TypeScript community. These guidelines are meant for contributors to the TypeScript project's codebase."**

Within those scoped guidelines, the **Components** section says: *"1 file per logical component (e.g. parser, scanner, emitter, checker)."* The **Names** section says: *"Use PascalCase for type names"* — but this refers to identifiers (class names, interface names, enum names), not filenames. There is no explicit rule for file naming case.

**Observed practice in TypeScript compiler source:** The TypeScript compiler's own source files (`checker.ts`, `parser.ts`, `scanner.ts`, `emitter.ts`, `binder.ts`) are all lowercase camelCase / single-word lowercase. This is consistent with the team's "1 file per logical component" philosophy where files happen to be named after their single camelCase export.

**Rationale given:** Consistency within the TypeScript team's own codebase. Explicitly not intended for external adoption.

**Verdict for this project:** No authority here. The disclaimer removes it from consideration as an external-facing guide.

---

## 3. Google TypeScript Style Guide

**Source:** <https://google.github.io/styleguide/tsguide.html> — Section 5.2.4 "Imports"

**What it says:** The only direct statement about file names appears in the Imports section:

> **"Module namespace imports are `lowerCamelCase` while files are `snake_case`, which means that imports correctly will not match in casing style, such as `import * as fooBar from './foo_bar';`"**

The guide mandates `snake_case` (underscores) for source filenames.

**Rationale given:** Not stated explicitly for filenames, but the guide's general principle (§9.3.1) is:

> "Code across projects should be consistent across irrelevant variations… The capitalization style of names."

**Verdict for this project:** The Google guide is an authoritative, widely-followed TypeScript style guide. It rejects PascalCase for files and chooses lowercase. It picks `snake_case` specifically (not kebab-case), but the shared property — all-lowercase — is the key safety property. This project already uses hyphens (kebab-case) in some files, making kebab-case the natural alignment with the Google direction while matching the rest of the ecosystem below.

---

## 4. eslint-plugin-unicorn — `filename-case` Rule

**Source:** <https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md>

**What it says:**

> **"Enforces filenames and directory names of linted files to use a certain case style and lowercase file extension. The default is `kebabCase`."**
>
> **"Consistent paths make files predictable to find and import, including on case-sensitive filesystems."**

The rule is enabled by default in the `recommended` config. Supported values: `kebabCase`, `camelCase`, `camelCaseWithAcronyms`, `snakeCase`, `pascalCase`. The default is explicitly `kebabCase`.

**Rationale given:** Cross-filesystem portability is the stated primary motivation — directly relevant to this project's Windows + Linux CI setup.

**Configuration capabilities relevant to this project:**

Single-case enforcement (recommended choice):
```js
'unicorn/filename-case': ['error', { case: 'kebabCase' }]
```

Multi-case (e.g., allow both for a React project mixing components and utilities):
```js
'unicorn/filename-case': [
  'error',
  {
    cases: {
      kebabCase: true,
      pascalCase: true,
    },
  },
]
```

Per-glob override to enforce PascalCase for `.ts`/`.tsx` only:
```js
// eslint.config.js example (from rule docs)
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    'unicorn/filename-case': ['error', { case: 'pascalCase', checkDirectories: false }],
  },
}
```

**Special case:** `index.ts`, `index.js`, `index.mjs`, etc. are ignored by the rule because they cannot change case. Their parent directories are still checked.

**Verdict for this project:** The rule's default and its explicit rationale ("including on case-sensitive filesystems") directly address the Windows/Linux cross-platform concern. The `kebabCase` default is the strongest signal from the tooling ecosystem. The `ignore` option can accommodate any truly exceptional files (e.g., `REUSE.toml`-covered configs).

---

## 5. NestJS Documentation

**Source:** <https://docs.nestjs.com/controllers> and <https://docs.nestjs.com/custom-decorators>

**What it says:** NestJS does not have a single dedicated "naming conventions" page, but its documentation and CLI generator consistently demonstrate a strict kebab-case convention for all TypeScript source files. Examples observed in the official docs:

| Class Name | File Name |
|---|---|
| `CatsController` | `cats.controller.ts` |
| `CreateCatDto` | `create-cat.dto.ts` |
| `AppModule` | `app.module.ts` |
| User decorator | `user.decorator.ts` |
| Auth decorator | `auth.decorator.ts` |

The NestJS CLI command `nest g controller cats` generates a file named `cats.controller.ts`, not `CatsController.ts`. This is the framework's enforced, generated convention.

**Rationale given:** Not stated explicitly in the docs, but the consistent multi-word kebab-case pattern (e.g., `create-cat.dto.ts`) demonstrates that kebab-case handles multi-word filenames more clearly than PascalCase would (`CreateCat.Dto.ts` is ambiguous).

**Verdict for this project:** NestJS is one of the most widely used TypeScript server frameworks. Its consistent, CLI-enforced convention is strong practical evidence that kebab-case is idiomatic for TypeScript server-side code. OpenDogShow is also a server-side TypeScript project with similar Clean Architecture layering.

---

## 6. Angular Style Guide

**Source:** <https://angular.dev/style-guide> — Section "Naming"

**What it says:** The Angular style guide has the clearest, most prescriptive rule of all sources examined:

> **"Separate words within a file name with hyphens (`-`). For example, a component named `UserProfile` has a file name `user-profile.ts`."**

> **"File names should generally describe the contents of the code in the file. When the file contains a TypeScript class, the file name should reflect that class name. For example, a file containing a component named `UserProfile` has the name `user-profile.ts`."**

**Rationale given:** Consistency of file name to TypeScript identifier. The guide also explicitly maps class names to kebab-case file names — showing that the `UserProfile` class → `user-profile.ts` pattern is the *intended* resolution to the "name after primary export" question.

**Verdict for this project:** Angular's style guide is maintained by Google (the same org behind the Google TypeScript Style Guide above), is widely followed, and is the most explicit on this exact question. A PascalCase class maps to a kebab-case filename — they do not mirror each other, but this is intentional and enforced.

---

## 7. Node.js Core Source — Observed Convention

**Source:** <https://github.com/nodejs/node/tree/main/lib>

**What it says:** Node.js core uses all-lowercase filenames throughout `lib/`. Multi-word modules use **snake_case** (underscores):

| File | Notes |
|---|---|
| `async_hooks.js` | multi-word, snake_case |
| `child_process.js` | multi-word, snake_case |
| `diagnostics_channel.js` | multi-word, snake_case |
| `string_decoder.js` | multi-word, snake_case |
| `trace_events.js` | multi-word, snake_case |
| `worker_threads.js` | multi-word, snake_case |
| `_http_agent.js` | underscore-prefixed private module |

**No PascalCase files are present anywhere in `lib/`.** Node.js is JavaScript, not TypeScript, but it is the runtime this project targets — its conventions carry weight as the "ambient" ecosystem norm.

**Rationale given:** No explicit statement, but all-lowercase is the POSIX filesystem safe baseline. The Node.js project follows this universally.

**Verdict for this project:** Convergent evidence: the runtime ecosystem itself avoids uppercase letters in filenames. Note that Node.js uses underscores while the TypeScript ecosystem (Angular, NestJS, unicorn) prefers hyphens — both are "kebab or snake" lowercase, not PascalCase.

---

## 8. Trade-off Analysis: PascalCase vs kebab-case

### 8.1 Cross-platform Safety (Windows + Linux CI)

| | PascalCase | kebab-case |
|---|---|---|
| Windows (NTFS, case-insensitive) | `DomainEvent.ts` and `domainevent.ts` resolve to the same file | No collision possible — all lowercase |
| Linux CI (case-sensitive) | `import './DomainEvent.js'` fails if someone writes `import './domainEvent.js'` | `import './domain-event.js'` is unambiguous |
| Risk level | **Real risk** — Windows devs can create files that CI rejects | **None** |

This is the decisive safety argument. The project explicitly targets Windows development + Linux CI. A case-sensitivity bug is invisible locally and only surfaces on CI, making it especially painful. ESLint `filename-case: kebabCase` prevents these files from ever being created.

### 8.2 "Named After Primary Export" Pattern

PascalCase is most natural when every file exports exactly one class or interface and the file is named after it: `SystemClock.ts` → `class SystemClock`. This pattern is clean and is used by some projects (e.g., Java, C#).

However, this project has a **mixed export profile**:

| File | Primary export type | PascalCase name | kebab-case name |
|---|---|---|---|
| `SystemClock.ts` | single class | `SystemClock.ts` ✅ | `system-clock.ts` ✅ |
| `FakeClock.ts` | single class | `FakeClock.ts` ✅ | `fake-clock.ts` ✅ |
| `codec.ts` | multiple utility functions | `Codec.ts`? ❌ misleading | `codec.ts` ✅ |
| `ids.ts` | multiple utility types + functions | `Ids.ts`? ❌ misleading | `ids.ts` ✅ |
| `ports.ts` | multiple interfaces | `Ports.ts`? ❌ misleading | `ports.ts` ✅ |

PascalCase breaks down for utility/multi-export modules. These comprise the entire `domain/` layer. Forcing `Ids.ts` or `Codec.ts` is actively misleading because there is no exported `Ids` class.

Angular's resolution — map class `UserProfile` to file `user-profile.ts` — accepts that filenames and identifiers use different conventions. This is the correct mental model: the filename describes the *module*, the identifier names the *symbol*.

### 8.3 Consistency Within Clean Architecture Layers

Clean Architecture in this project creates three distinct file types per layer:

- **`domain/`**: mostly multi-export utility modules (`ids.ts`, `ports.ts`, `codec.ts`, `DomainEvent.ts`)  
- **`infrastructure/`**: mostly single-class modules (`SystemClock.ts`, `RandomIdGenerator.ts`)  
- **`testing/`**: mostly single-class fakes (`FakeClock.ts`, `FakeIdGenerator.ts`)

The current mixed state (`infrastructure/` and `testing/` use PascalCase, `domain/` uses a mix) reflects exactly the "single-class vs. multi-export" split. The problem is that the split is **architectural**, not **naming-convention** — both layers should follow the same rule. Choosing PascalCase would require inventing names like `Ids.ts` for utility modules; kebab-case requires only renaming `SystemClock.ts` → `system-clock.ts` etc., which is mechanical and unambiguous.

### 8.4 ESLint Enforcement

`eslint-plugin-unicorn`'s `filename-case` rule:

- Supports both `kebabCase` and `pascalCase`
- Default is `kebabCase`
- Enforces directory names too (with `checkDirectories: true`, the default)
- `index.ts` files are automatically excluded
- Can use `ignore` array for any exceptions
- Works with any language, not just JS/TS

A single line addition to `eslint.config.js` enforces the convention for the entire monorepo:

```js
'unicorn/filename-case': ['error', { case: 'kebabCase' }]
```

There is no equivalently simple way to enforce "PascalCase for classes, kebab-case for utilities" — that distinction requires semantic analysis beyond filename rules.

### 8.5 NodeNext `.js` Import Extensions

Both conventions work identically with NodeNext `moduleResolution`. Writing `.js` extensions on `.ts` imports is required by the `NodeNext` resolution mode regardless of naming case:

```ts
// Both of these are equally valid with NodeNext:
import { SystemClock } from './SystemClock.js';
import { SystemClock } from './system-clock.js';
```

Neither convention has any advantage here. The `.js` extension requirement is purely about module resolution semantics, not filename casing.

---

## 9. Recommendation

**Adopt kebab-case uniformly across the entire monorepo.**

### Final choice

```
packages/kernel/src/domain/codec.ts         ✅ already correct
packages/kernel/src/domain/ids.ts           ✅ already correct  
packages/kernel/src/domain/ports.ts         ✅ already correct
packages/kernel/src/domain/DomainEvent.ts   → domain-event.ts
packages/kernel/src/infrastructure/SystemClock.ts    → system-clock.ts
packages/kernel/src/infrastructure/RandomIdGenerator.ts → random-id-generator.ts
packages/kernel/src/testing/FakeClock.ts    → fake-clock.ts
packages/kernel/src/testing/FakeIdGenerator.ts → fake-id-generator.ts
```

### Justification summary

1. **Safety**: Eliminates the only class of Windows/Linux filesystem collision bugs — a real concern for this project.
2. **Authoritative sources converge**: Angular (Google), Google TypeScript Style Guide, NestJS, Node.js core, and eslint-plugin-unicorn's default all choose all-lowercase filenames. No authoritative TypeScript-ecosystem source recommends PascalCase for server-side projects.
3. **Handles the whole project uniformly**: Utility modules (`ids.ts`, `codec.ts`) and class modules (`system-clock.ts`) both fit naturally. PascalCase forces awkward names for utility modules.
4. **Aligns with existing `domain/` layer**: The kebab-case files already present (`codec.ts`, `ids.ts`, `ports.ts`) are already correct.
5. **Tooling support**: One-line ESLint config, default behavior of the leading lint plugin.

### ESLint configuration snippet

Add to `eslint.config.js` (or the relevant config object in the flat config array):

```js
// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import unicorn from 'eslint-plugin-unicorn';

export default [
  // … existing config …
  {
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
    },
  },
];
```

**Notes on the configuration:**
- `checkDirectories: true` (the default) also enforces kebab-case on folder names, which is correct for this project (`domain/`, `infrastructure/`, `testing/` are already compliant).
- `index.ts` files are automatically excluded — they cannot be renamed.
- Files matching path segments starting with `$` are ignored (route parameters pattern).
- Add specific `ignore` entries for any third-party-driven exceptions (e.g., `README.md`, `REUSE.toml` are not linted as TypeScript so they are unaffected anyway).

Install the plugin if not already present:

```sh
pnpm add -D eslint-plugin-unicorn
```
