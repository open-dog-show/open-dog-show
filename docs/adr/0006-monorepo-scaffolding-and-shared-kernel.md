---
status: accepted
---

# Monorepo scaffolding and shared-kernel foundation

> Implements the foundation from [ADR-0004](0004-tech-stack-typescript-modular-monolith-postgres.md) (issue #13). Records the _architectural_ scaffolding decisions and the shared-kernel shape; ordinary tooling picks (lint/test libraries) are noted but not treated as lock-in.

> **Amended 2026-08-22:** the outbox scope columns are `scope` / `user_id`
> (renamed from `scope_kind` / `account_id`, issue #76), and the kernel-role
> note below now reflects that `@ods/kernel` houses the shared
> transactional-outbox scaffolding. The domain layer still imports no `pg`/ORM.

## Context

ADR-0004 fixed the stack (pnpm monorepo, modular monolith, transactional outbox, single Postgres with schema-per-context, Drizzle behind repository ports) but left the concrete scaffolding open: how packages are arranged and how clean architecture lives inside them, what the shared-kernel primitives look like, and how the outbox, migrations, and "add a context with one command" actually work. This ADR records those so a future reader understands the shape before touching code.

## Decision

**Two-axis package structure.** Bounded contexts are the _vertical_ axis (packages); clean-architecture layers are the _horizontal_ axis (folders **inside** each context). Neither is enough alone.

```
packages/
  kernel/                  → @ods/kernel      (domain primitives, ports, and shared transactional-outbox scaffolding)
  test-kit/                → @ods/test-kit    (Testcontainers helper, fixtures)
  contexts/<name>/         → @ods/<name>      one per bounded context, each with:
    src/domain/            entities, value objects, domain events, PORT interfaces (pure)
    src/application/       use-cases; depends on domain only
    src/infrastructure/    Drizzle adapters, outbox writer, migrations, ACL clients
    src/index.ts           the context's public surface + registration function
  rulesets-impl/<club>/    → @ods/ruleset-*   pure domain modules (ADR-0001)
apps/
  api/                     → @ods/api         the single deployable = composition root
```

Dependencies point **inward** (`infrastructure → application → domain`); Drizzle is importable only under `infrastructure/`, keeping the ADR-0001 core ORM-free. Contexts never import each other; `apps/api` composes them.

**Boundaries are lint-enforced on both axes** (`eslint-plugin-boundaries`, ESLint flat config): a _layer_ taxonomy (inward-only) and a _context-zone_ taxonomy (only `@ods/kernel` and `@ods/rulesets` importable by all; `payments`/`identity` reachable only through an ACL adapter in the consumer's `infrastructure/`). The ADR-0002 relationships thus become CI-checked rules, not prose.

**Shared kernel (`@ods/kernel`, domain layer).**

- **Identifiers:** **UUIDv4** in native Postgres `uuid` columns, wrapped in **per-entity branded types** (`ShowId`, `DogId`, `TenantId`, `ExhibitorId`, …) so reference-by-ID across contexts is type-checked. UUIDv4 (not v7/ULID) is chosen to avoid the creation-timestamp leak a time-ordered id embeds in externally-visible identifiers.
- **`DomainEvent` envelope:** `{ eventId, type, occurredAt, scope, aggregateId, payload }`. `type` is a context-prefixed string (`entries.EntrySubmitted`) that doubles as the schema-version key. `scope` is an extensible `EventScope` union (see ADR-0005). No correlation/causation metadata until a consumer needs it.
- **Ports:** `Clock` and `IdGenerator` interfaces, so the core has no ambient `Date.now()`/`randomUUID()` and stays deterministically testable; real implementations are injected by `apps/api`.

**Transactional outbox.** A per-context-schema `outbox` table co-located with the write model, written in the same transaction as the domain change via the shared `withTransaction(scope, fn)` seam (which also sets the RLS session vars — ADR-0005). Columns flatten the scope (`scope`, nullable `tenant_id`/`user_id`) so a dispatcher can route in SQL and later map to NATS subjects; `payload` is `jsonb`; a `bigserial seq` is the dispatch cursor; dispatched rows are **soft-deleted** (`dispatched_at`) for observability and prunable later. A **polling dispatcher** (`… WHERE dispatched_at IS NULL ORDER BY seq … FOR UPDATE SKIP LOCKED`) delivers **at-least-once** to idempotent, `event_id`-keyed handlers; ordering is per-aggregate, not global. `LISTEN/NOTIFY` is a deferred latency optimisation.

**Migrations.** Per-context migration folders owned by each context; `drizzle-kit generate` for table DDL plus **hand-written SQL** for RLS policies, roles, and `CREATE SCHEMA` (which drizzle-kit cannot model). A thin custom runner discovers all contexts' migrations and applies them as the **migration-owner role**. A `0000_` bootstrap migration (schema + outbox table + the two roles + RLS setup) is stamped into every new context.

**Repository ports** are thin, per-aggregate, hand-written interfaces in each context's `domain/` (e.g. `EntryRepository { load; save }`); no generic `Repository<T>` base and no unit-of-work/dirty-tracking (ADR-0004 rejected that ORM style).

**Context generator.** `plop` (`pnpm new:context <name>`) stamps a context package that _boots_ — its generated Testcontainers integration test proves the migration applies and the outbox round-trips, satisfying the "new context boots against dev Postgres" acceptance criterion. `turbo gen` was avoided because ADR-0004 defers Turborepo.

**Tooling (easily swappable, recorded for orientation, not lock-in):** ESLint + Prettier, Vitest, Testcontainers, GitHub Actions, ESM-only with live-source internal packages and `tsup` building only `apps/api`.

## Considered options

- **Contexts as packages _or_ layers as packages** — rejected: each alone under-constrains; the two-axis structure makes both ADR-0001 (layers) and ADR-0002 (contexts) structural.
- **Generic `Repository<T>` base** — rejected: leaks a CRUD shape into the domain, against ADR-0001's deep-narrow ports.
- **`LISTEN/NOTIFY`-first dispatcher** — rejected for the skeleton: notifications aren't durable, so a polling fallback is needed anyway; polling alone is the correct baseline.
- **TypeScript project references / compiled `dist` graph** — deferred: live-source internal packages keep "add a context, it boots" friction-free; project references can be added if typecheck times bite.

## Consequences

- The self-host footprint stays "one app container + one Postgres" (ADR-0004), with the outbox→NATS extraction path pre-shaped.
- Discipline lives in CI lint rules, not physical walls — the boundary config must be maintained.
- Docker becomes a hard dev prerequisite (Testcontainers); documented as such.
- Library choices here are intentionally reversible; only the architectural shape (two-axis packages, outbox pattern, per-table RLS, generator-enforced boots) is meant to be stable.
