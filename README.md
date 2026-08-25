# OpenDogShow

Open-source platform for running **conformation ("beauty") dog shows** — online entries, judging, catalogue, and results — built to keep the cost of organising a show **low for small clubs**.

The domain core is **kennel-club-agnostic**: kennel-club rules (FCI, and the Belgian member SRSH/KMSH first; AKC/KC later) plug in as composable **rulesets**, so the platform is not tied to one jurisdiction. It is a clean-room design derived from real kennel-club regulations — never from any competitor's product.

## Design

Domain-model-first, DDD + clean architecture, framework-agnostic ("don't marry the framework").

- **Ubiquitous language:** [`CONTEXT.md`](./CONTEXT.md)
- **Bounded-context map:** [`CONTEXT-MAP.md`](./CONTEXT-MAP.md)
- **Core domain invariants:** [`docs/domain-invariants.md`](./docs/domain-invariants.md)
- **Architecture decisions:** [`docs/adr/`](./docs/adr/)
- **Research (primary sources):** on `research/*` branches under `docs/research/`

## Status

### Foundation build phase (issue #22)

Domain-model spec complete. Foundation build phase complete.

| #   | Task                                                                         | State     |
| --- | ---------------------------------------------------------------------------- | --------- |
| T1  | Monorepo bootstrap — pnpm workspace, TypeScript/ESLint/Vitest config         | ✅ merged |
| T2  | REUSE/SPDX compliance — SPDX headers + `REUSE.toml` bulk declarations        | ✅ merged |
| T3  | Test-kit — Postgres harness and migration runner                             | ✅ merged |
| T4  | `withTransaction`, RLS scaffold, and sample bounded context (`entry`/`show`) | ✅ merged |
| T5  | Transactional outbox and polling dispatcher (`@ods/kernel`)                  | ✅ merged |
| T6  | Boundary-lint enforcement — ESLint layer and context-zone rules              | ✅ merged |
| T7  | Context generator — `pnpm new:context <name>` (Plop)                         | ✅ merged |

### Rulesets context (issue #14)

| Issue | Task                                                                     | PR  | State     |
| ----- | ------------------------------------------------------------------------ | --- | --------- |
| #55   | Domain-model update: CONTEXT.md + ADR-0001/ADR-0007 amendments           | #56 | ✅ merged |
| #50   | T1 — scaffold `@ods/rulesets` and define all domain data types           | #57 | ✅ merged |
| #51   | T2 — `resolveEffectiveRuleset`: compose layers into a versioned snapshot | #58 | ✅ merged |
| #52   | T3 — `ClassEligibilityPolicy` port and FCI in-memory implementation      | #60 | ✅ merged |
| #53   | T4 — `AwardPolicy` port, `JudgingScopeResults` union, FCI in-memory      | #61 | ✅ merged |
| #54   | T5 — `CollectiveAwardPolicy` port and FCI in-memory implementation       | #63 | ✅ merged |
| #62   | FCI and KMSH `RulesetLayer` data implementations                         | #65 | ✅ merged |
| #64   | Remove `name: string` from domain types (i18n owns all display names)    | #70 | ✅ merged |
| #66   | Extract layer data into `@ods/rulesets/layers` sub-path export           | #71 | ✅ merged |
| #67   | Split `AwardType` into `IndividualAwardType \| CollectiveAwardType`      | #72 | ✅ merged |

Additional work merged on `main`:

- Automated third-party attribution check (`scripts/check-notice.ts`) enforced in CI
- Kebab-case file naming enforcement via `eslint-plugin-unicorn`
- `withTransaction` / `withOutboxTransaction` split in kernel
- JSDoc annotations on the kernel public API

## Getting started

```sh
# Prerequisites: Node.js ≥ 22, pnpm ≥ 9
pnpm install       # set up the workspace
pnpm skill:install # fetch the respond-pr-review PR-review skill locally (optional dev tooling)
pnpm lint          # ESLint + Prettier check
pnpm test          # Vitest unit tests
pnpm typecheck     # TypeScript type check (no emit)
```

## Licence & contributing

Licensed under **AGPL-3.0** (see [`LICENSE`](./LICENSE)). Contributions are welcome under the Developer Certificate of Origin and the clean-room anti-copy policy — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
