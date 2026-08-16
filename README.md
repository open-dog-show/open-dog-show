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

Domain-model spec complete. Foundation build phase complete.

| #   | Task                                                                                        | State     |
| --- | ------------------------------------------------------------------------------------------- | --------- |
| T1  | Monorepo bootstrap — pnpm workspace, TypeScript/ESLint/Vitest config                        | ✅ merged |
| T2  | REUSE/SPDX compliance — SPDX headers + `REUSE.toml` bulk declarations                       | ✅ merged |
| T3  | Test-kit — Postgres harness and migration runner                                            | ✅ merged |
| T4  | `withTransaction`, RLS scaffold, and sample bounded context (`entry`/`show`)                | ✅ merged |
| T5  | Transactional outbox and polling dispatcher (`@ods/kernel`)                                 | ✅ merged |
| T6  | Boundary-lint enforcement — ESLint layer and context-zone rules                             | ✅ merged |
| T7  | Context generator — `pnpm new:context <name>` (Plop)                                        | ✅ merged |
| T8  | Rulesets bounded context (`@ods/rulesets`) — domain types, policy ports, Published Language | ✅ merged |

Additional work merged on `main`:

- Automated third-party attribution check (`scripts/check-notice.ts`) enforced in CI
- Kebab-case file naming enforcement via `eslint-plugin-unicorn`
- `withTransaction` / `withOutboxTransaction` split in kernel
- JSDoc annotations on the kernel public API

## Getting started

```sh
# Prerequisites: Node.js ≥ 22, pnpm ≥ 9
pnpm install       # set up the workspace
pnpm lint          # ESLint + Prettier check
pnpm test          # Vitest unit tests
pnpm typecheck     # TypeScript type check (no emit)
```

## Licence & contributing

Licensed under **AGPL-3.0** (see [`LICENSE`](./LICENSE)). Contributions are welcome under the Developer Certificate of Origin and the clean-room anti-copy policy — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
