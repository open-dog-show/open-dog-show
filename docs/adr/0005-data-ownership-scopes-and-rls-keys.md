---
status: accepted
---

# Data-ownership scopes and row-level-security keys

> Refines [ADR-0004](0004-tech-stack-typescript-modular-monolith-postgres.md), whose "row-level `tenant_id` + RLS on every table" is an oversimplification. Grounded in the research note *Data-ownership / isolation scoping regimes* (branch `research/data-ownership-scopes`, `docs/research/2026-08-01-data-ownership-scopes.md`).

## Context

ADR-0004 chose row-level multi-tenancy: `tenant_id` + PostgreSQL Row-Level Security, "applied inside each context schema," with "single-tenant = one `tenant_id`." That framing assumes **every** row is owned by a tenant. The domain contradicts it:

- A **`Dog`** (with its `Ownership`, `Pedigree` reference, and owner-asserted `Title`s) "exists independently of any Show and is reused across many Entries" (`CONTEXT.md`). An owner enters the same Dog into shows run by **different Clubs**, so that data cannot be owned by one Club.
- **Rulesets**, the **Ruleset Catalog**, Platform Administration config, and **`User`** accounts are reference/operator data **no Club owns**.
- Meanwhile a **tenant is a Club** — "Platform Administration onboards Clubs (tenants)."

So a single uniform `tenant_id` key is wrong: different data has different owners, and some rows (an `Entry`, a `Payment`) are owned by a Club yet must also be readable by the exhibitor who created them.

## Decision

Data isolation is **scope-per-table**, not one universal `tenant_id`. There are **three active scopes**:

- **`tenant` (Club)** — data owned by one organising Club: Shows, rings, classes, catalogues, per-show ring results. RLS key `tenant_id`.
- **`exhibitor` (cross-tenant participant)** — the owner's durable "dog administration": `Dog`, `Ownership`, `Pedigree` reference, `Title`. RLS key `account_id` (the owning account); shared across Clubs.
- **`platform` (global)** — reference and operator data no Club owns: `Ruleset`, `Ruleset Catalog`, Platform Administration config, `User`. Not Club-isolated.

Two further scopes are **latent and deferred** — documented, not built:

- **`judge`** — a Judge owns no isolated on-platform data today (assignments/results are `tenant`-scoped; breed authorisation is `platform`/NCO reference). Add a `judge` scope only when a judge self-service surface exists.
- **`nco`** — the NCO is an external authority (studbook, judge authorisation, CAC/title confirmation are all external; `Title` is owner-asserted). It becomes an internal scope only if NCOs are given platform accounts to confirm on-platform.

**Hybrid rows need a disjunctive predicate, not a single key.** An `Entry` (and its `Payment`) is owned by the host Club but must be visible to the exhibitor who created it:

```sql
USING (tenant_id = current_setting('app.tenant_id')::uuid
   OR  account_id = current_setting('app.account_id')::uuid)
```

**Two distinct concepts, not one.** *Who a fact belongs to* (the event's `EventScope` — `{ tenant | exhibitor | platform }` on the domain event / outbox row) is **not** the same as *who may read a row* (the RLS predicate). Hybrid rows carry a single ownership scope but a wider read predicate.

**Mechanism.** The request identity reaches RLS through session variables (`SET LOCAL app.tenant_id`, `SET LOCAL app.account_id`) set once per transaction in the shared `withTransaction(scope, fn)` unit-of-work; policies read them via `current_setting(..., true)`. The runtime application connects as a **non-owner Postgres role with RLS enforced** — never as a superuser or table owner, for whom RLS is bypassed. `platform` tables are RLS-exempt (or role-gated). The `Catalogue`'s time-gated public-read predicate is authored by Catalogue & Publishing, not the shared scaffold.

## Considered options

- **Keep the uniform `tenant_id` on every table (ADR-0004 as written)** — rejected: it cannot express cross-tenant `Dog` administration, global reference data, or exhibitor-visible `Entry`/`Payment`, and would either duplicate a Dog per Club or silently leak.
- **Copy Dog/Owner/Title per Club** — rejected: destroys the "one durable Dog identity reused across Entries" model and the portability goal.
- **Application-level filtering instead of RLS** — rejected: loses the defence-in-depth ADR-0004 chose RLS for; one missed `WHERE` clause becomes a cross-tenant leak.

## Consequences

- The RLS scaffolding ships **three policy templates** (`tenant`, `exhibitor`, `hybrid`) plus `platform` = exempt, applied per table rather than one blanket rule.
- `EventScope` is a small, extensible discriminated union seeded with the three active scopes; adding `judge`/`nco` later is additive.
- "Single-tenant = one `tenant_id`" (ADR-0004) holds only for Club data; exhibitor and platform data exist even in a single-tenant deployment.
- The migration-owner role and the runtime app role must be **separate Postgres roles**, or RLS silently no-ops — the scaffolding enforces this split.
