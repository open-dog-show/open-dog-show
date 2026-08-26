---
status: accepted
---

# Data-ownership scopes and row-level-security keys

> Refines [ADR-0004](0004-tech-stack-typescript-modular-monolith-postgres.md), whose "row-level `club_id` + RLS on every table" is an oversimplification. Grounded in the research note _Data-ownership / isolation scoping regimes_ (branch `research/data-ownership-scopes`, `docs/research/2026-08-01-data-ownership-scopes.md`).

> **Amended 2026-08-22:** the RLS session variable and exhibitor-scope key are
> `app.user_id` / `user_id` — deliberately renamed from `app.account_id` /
> `account_id` (issue #76) so the ubiquitous-language term _User_ is used
> consistently; this ADR now matches the as-built kernel.

> **Amended 2026-08-24:** the TypeScript type that produces the `app.user_id` /
> `user_id` value is `PrincipalId` — the kernel's context-neutral actor id — not
> `UserId`; see [ADR-0013](0013-kernel-principal-id-iam-owned-user-id.md). `UserId`
> moved to `@ods/iam` (ADR-0011). The `app.user_id` GUC and the `user_id` column
> are unchanged on the wire; only the kernel's TS type and field names became
> `principalId`.

> **Amended 2026-08-26:** the `tenant` data-ownership scope was renamed to `club`
> throughout (issue #116): the RLS key `tenant_id` is now `club_id`, the GUC
> `app.tenant_id` is now `app.club_id`, and the `EventScope`/`TransactionScope`
> literal `'tenant'` is now `'club'`. The `exhibitor` and `platform` scopes are
> unchanged. Prior amendment notes are left intact as historical record.

## Context

ADR-0004 chose row-level multi-Club isolation: `club_id` + PostgreSQL Row-Level Security, "applied inside each context schema," with "single-Club = one `club_id`." That framing assumes **every** row is owned by a Club. The domain contradicts it:

- A **`Dog`** (with its `Ownership`, `Pedigree` reference, and owner-asserted `Title`s) "exists independently of any Show and is reused across many Entries" (`CONTEXT.md`). An owner enters the same Dog into shows run by **different Clubs**, so that data cannot be owned by one Club.
- **Rulesets**, the **Ruleset Catalog**, Platform Administration config, and **`User`** accounts are reference/operator data **no Club owns**.
- Meanwhile the **`club` scope is a Club** — "Platform Administration onboards Clubs."

So a single uniform `club_id` key is wrong: different data has different owners, and some rows (an `Entry`, a `Payment`) are owned by a Club yet must also be readable by the exhibitor who created them.

## Decision

Data isolation is **scope-per-table**, not one universal `club_id`. There are **three active scopes**:

- **`club` (Club)** — data owned by one organising Club: Shows, rings, classes, catalogues, per-show ring results. RLS key `club_id`.
- **`exhibitor` (cross-Club participant)** — the owner's durable "dog administration": `Dog`, `Ownership`, `Pedigree` reference, `Title`. RLS key `user_id` (the owning user); shared across Clubs.
- **`platform` (global)** — reference and operator data no Club owns: `Ruleset`, `Ruleset Catalog`, Platform Administration config, `User`. Not Club-isolated.

Two further scopes are **latent and deferred** — documented, not built:

- **`judge`** — a Judge owns no isolated on-platform data today (assignments/results are `club`-scoped; breed authorisation is `platform`/NCO reference). Add a `judge` scope only when a judge self-service surface exists.
- **`nco`** — the NCO is an external authority (studbook, judge authorisation, CAC/title confirmation are all external; `Title` is owner-asserted). It becomes an internal scope only if NCOs are given platform accounts to confirm on-platform.

**Hybrid rows need a disjunctive predicate, not a single key.** An `Entry` (and its `Payment`) is owned by the host Club but must be visible to the exhibitor who created it:

```sql
USING (
  club_id   = nullif(current_setting('app.club_id',   true), '')::uuid
  OR user_id = nullif(current_setting('app.user_id', true), '')::uuid
)
```

**Two distinct concepts, not one.** _Who a fact belongs to_ (the event's `EventScope` — `{ club | exhibitor | platform }` on the domain event / outbox row) is **not** the same as _who may read a row_ (the RLS predicate). Hybrid rows carry a single ownership scope but a wider read predicate.

**Mechanism.** The request identity reaches RLS through session variables (`SET LOCAL app.club_id`, `SET LOCAL app.user_id`) set once per transaction in the shared `withTransaction(scope, fn)` unit-of-work; policies read them via `current_setting(..., true)`. The runtime application connects as a **non-owner Postgres role with RLS enforced** — never as a superuser or table owner, for whom RLS is bypassed. `platform` tables are RLS-exempt (or role-gated). The `Catalogue`'s time-gated public-read predicate is authored by Catalogue & Publishing, not the shared scaffold.

## Considered options

- **Keep the uniform `club_id` on every table (ADR-0004 as written)** — rejected: it cannot express cross-Club `Dog` administration, global reference data, or exhibitor-visible `Entry`/`Payment`, and would either duplicate a Dog per Club or silently leak.
- **Copy Dog/Owner/Title per Club** — rejected: destroys the "one durable Dog identity reused across Entries" model and the portability goal.
- **Application-level filtering instead of RLS** — rejected: loses the defence-in-depth ADR-0004 chose RLS for; one missed `WHERE` clause becomes a cross-Club leak.

## Consequences

- The RLS scaffolding ships **three policy templates** (`club`, `exhibitor`, `hybrid`) plus `platform` = exempt, applied per table rather than one blanket rule.
- `EventScope` is a small, extensible discriminated union seeded with the three active scopes; adding `judge`/`nco` later is additive.
- "Single-Club = one `club_id`" (ADR-0004) holds only for Club data; exhibitor and platform data exist even in a single-Club deployment.
- The migration-owner role and the runtime app role must be **separate Postgres roles**, or RLS silently no-ops — the scaffolding enforces this split.
