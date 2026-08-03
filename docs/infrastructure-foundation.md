# Infrastructure foundation

Developer reference for the monorepo scaffold delivered in T1–T8. It covers
every reusable primitive, the conventions all bounded contexts follow, and a
step-by-step guide for adding a new context.

> **Related docs**
> - ADR-0004 — tech stack
> - ADR-0005 — data-ownership scopes and RLS
> - ADR-0006 — monorepo scaffolding and shared kernel
> - [`CONTEXT.md`](../CONTEXT.md) — ubiquitous language
> - [`CONTEXT-MAP.md`](../CONTEXT-MAP.md) — bounded-context relationships

---

## Package layout

```
packages/
  kernel/          @ods/kernel      domain primitives + infra helpers + test fakes
  test-kit/        @ods/test-kit    Testcontainers harness and migration runner
  contexts/
    sample/        @ods/sample      worked example — the pattern every real context copies
  rulesets-impl/   @ods/ruleset-*   (future) pure domain ruleset modules
apps/
  api/             @ods/api         composition root (not yet scaffolded)
```

Internal packages have `"noEmit": true` and live-source each other via `exports`
pointing directly at `.ts` files — no build step needed inside the monorepo.

---

## `@ods/kernel`

### Domain primitives

#### `DomainEvent<TPayload>`

The canonical event shape every context emits.

```ts
interface DomainEvent<TPayload> {
  eventId:     string;      // UUID
  type:        string;      // e.g. 'entries.EntrySubmitted'
  occurredAt:  Date;
  scope:       EventScope;  // 'tenant' | 'exhibitor' | 'platform'
  aggregateId: string;
  payload:     TPayload;
}
```

`EventScope` records **who owns the fact** — it determines which RLS columns
(`tenant_id` / `account_id`) the outbox writer populates, and which columns
the dispatcher can use to route the event to the right subscriber.

Create events with the factory, never with a literal:

```ts
import { createDomainEvent, FakeClock, FakeIdGenerator } from '@ods/kernel';

const event = createDomainEvent(
  {
    type:        'entries.EntrySubmitted',
    scope:       'tenant',
    aggregateId: entryId,
    payload:     { dogName: 'Fido' },
  },
  { clock, idGenerator },   // injected — use SystemClock/RandomIdGenerator in prod
);
```

The factory fills `eventId` and `occurredAt` from the injected ports, so tests
can use `FakeClock` / `FakeIdGenerator` and get deterministic, assertable events.

#### `DomainEventCodec` — `encodeDomainEvent` / `decodeDomainEvent`

Converts between `DomainEvent<TPayload>` (runtime shape, `occurredAt` is a
`Date`) and `DomainEventJson` (JSON-safe, `occurredAt` is an ISO-8601 string).
Used by `PgOutboxWriter` and `PgPollingDispatcher` internally; also useful for
any context that serialises events over HTTP or a message bus.

```ts
import { encodeDomainEvent, decodeDomainEvent } from '@ods/kernel';

const json = encodeDomainEvent(event);     // → DomainEventJson
const back = decodeDomainEvent<MyPayload>(json); // → DomainEvent<MyPayload>
```

#### Branded domain IDs

Thin compile-time brands over `string` — the type system blocks you from
accidentally passing a `ShowId` where a `DogId` is required, while the runtime
value stays a plain UUID string.

```ts
import { asShowId, asTenantId, type ShowId, type TenantId } from '@ods/kernel';

const showId: ShowId   = asShowId('00000000-…');
const tenantId: TenantId = asTenantId('00000000-…');
```

Available IDs: `ShowId`, `DogId`, `TenantId`, `ExhibitorId`, `AccountId`.
Contexts add their own branded IDs in `src/domain/domain-ids.ts` (local to
that context) using the same `Brand<T, B>` pattern — copy it from the kernel
source rather than depending on the kernel for every new ID type.

#### `Clock` and `IdGenerator` ports

Infrastructure ports defined in the domain layer so business logic never
touches `new Date()` or `randomUUID()` directly.

```ts
interface Clock       { now():      Date   }
interface IdGenerator { generate(): string }
```

| Scenario    | Implementation           |
|-------------|--------------------------|
| Production  | `SystemClock`, `RandomIdGenerator` (both from `@ods/kernel`) |
| Unit tests  | `FakeClock`, `FakeIdGenerator` (both from `@ods/kernel`) |

#### `TransactionScope`

Describes **who is acting** so the transaction helper can set the correct RLS
session variables. Distinct from `EventScope` — see ADR-0005 §"Two distinct
concepts".

```ts
type TransactionScope =
  | { kind: 'tenant';    tenantId: TenantId; accountId: AccountId }
  | { kind: 'exhibitor'; accountId: AccountId }
  | { kind: 'platform' };
```

| Kind        | `app.tenant_id` | `app.account_id` | Who uses it |
|-------------|-----------------|------------------|-------------|
| `tenant`    | Club UUID       | User UUID        | Club admins, Show Secretaries |
| `exhibitor` | _(empty)_       | User UUID        | Dog owners entering cross-tenant |
| `platform`  | _(empty)_       | _(empty)_        | Platform administrators, background jobs |

#### `OutboxAppender`

A minimal accumulator interface passed to the `withOutboxTransaction` callback.
Decouples business logic from the concrete outbox table.

```ts
interface OutboxAppender {
  append(...events: DomainEvent<unknown>[]): void;
}
```

---

### Infrastructure helpers

#### `withTransaction`

Opens a connection, calls `BEGIN`, sets RLS session variables, runs the
callback, then `COMMIT`s (or `ROLLBACK`s on error).

Use for units of work that **do not emit domain events**.

```ts
import { withTransaction } from '@ods/kernel';

const shows = await withTransaction(pool, scope, async (client) => {
  const repo = new DrizzleShowRepository(client);
  return repo.findAll();
});
```

The `client` is a `pg.PoolClient` scoped to this transaction. Pass it directly
to Drizzle or raw `client.query()` calls — do not create a second connection.

#### `withOutboxTransaction`

The outbox-aware variant. The callback receives both a `pg.PoolClient` _and_
an `OutboxAppender`. Any events appended during the callback are written to
the context's outbox table inside the **same transaction**, immediately before
`COMMIT`. A rollback cancels both the aggregate change and the outbox rows.

Use for units of work that **emit domain events**.

```ts
import { withOutboxTransaction, PgOutboxWriter } from '@ods/kernel';

const writer = new PgOutboxWriter('entries');   // schema name

await withOutboxTransaction(pool, scope, writer, async (client, outbox) => {
  const repo = new DrizzleEntryRepository(client);
  await repo.save(entry);
  outbox.append(
    createDomainEvent({ type: 'entries.EntrySubmitted', … }, { clock, idGenerator }),
  );
});
```

#### `PgOutboxWriter`

Writes events to `<schema>.outbox` within the active transaction.
One instance per bounded context; constructed with the schema name.

```ts
const writer = new PgOutboxWriter('entries');
```

Writes are idempotent (`ON CONFLICT (event_id) DO NOTHING`), so retrying the
same unit-of-work never creates duplicate outbox rows.

Expected outbox table columns:

| Column         | Type          | Notes |
|----------------|---------------|-------|
| `seq`          | `BIGSERIAL`   | delivery order |
| `event_id`     | `UUID UNIQUE` | idempotency key |
| `type`         | `TEXT`        | |
| `occurred_at`  | `TIMESTAMPTZ` | |
| `scope`        | `TEXT`        | `'tenant'` / `'exhibitor'` / `'platform'` |
| `tenant_id`    | `UUID`        | nullable |
| `account_id`   | `UUID`        | nullable |
| `aggregate_id` | `TEXT`        | |
| `payload`      | `JSONB`       | |
| `dispatched_at`| `TIMESTAMPTZ` | nullable — `NULL` = pending |

The bootstrap migration in every context's `migrations/0000_bootstrap.sql`
creates this table.

#### `PgPollingDispatcher`

Reads pending outbox rows and delivers them to an `EventHandler`. Constructed
with the pool, schema name, and handler function.

```ts
import { PgPollingDispatcher } from '@ods/kernel';

const dispatcher = new PgPollingDispatcher(pool, 'entries', async (event) => {
  // route by event.type, call application service, etc.
  await handleEvent(event);
});

// Call poll() on a timer or after each write:
const dispatched = await dispatcher.poll(10);  // batchSize = 10
```

Delivery semantics:

- **At-least-once** — a crash after the handler succeeds but before
  `dispatched_at` is committed causes redelivery. Handlers must be idempotent
  on `event.eventId`.
- **`FOR UPDATE SKIP LOCKED`** — concurrent dispatcher instances never process
  the same row.
- Each row is processed in its own transaction — a handler failure rolls back
  only that row; previously dispatched rows in the same batch are unaffected.

#### `SystemClock` and `RandomIdGenerator`

Production implementations of the `Clock` and `IdGenerator` ports. Wire them
in at the composition root (`apps/api`).

```ts
import { SystemClock, RandomIdGenerator } from '@ods/kernel';
```

---

### Testing helpers

#### `FakeClock`

Deterministic `Clock` for unit tests. Starts at a given `Date` (default Unix
epoch); advance with `tick(ms)`.

```ts
import { FakeClock } from '@ods/kernel';

const clock = new FakeClock(new Date('2026-08-01T12:00:00Z'));
clock.tick(5_000); // advance 5 seconds
```

#### `FakeIdGenerator`

Deterministic `IdGenerator`. Returns valid UUID v4-shaped strings with an
incrementing suffix (`00000000-0000-4000-8000-000000000001`, …). `reset()`
restarts from the seed.

```ts
import { FakeIdGenerator } from '@ods/kernel';

const idGen = new FakeIdGenerator(1);  // seed = 1
idGen.generate(); // → '00000000-0000-4000-8000-000000000001'
idGen.generate(); // → '00000000-0000-4000-8000-000000000002'
idGen.reset();
```

---

## `@ods/test-kit`

#### `PostgresHarness`

Spins up a throwaway PostgreSQL container via Testcontainers. Use in
integration tests with `beforeAll` / `afterAll`.

```ts
import { PostgresHarness } from '@ods/test-kit';

const harness = new PostgresHarness();

beforeAll(async () => { await harness.start(); }, 120_000);
afterAll(async  () => { await harness.stop();  });

// harness.connectionUrl — postgresql://… superuser URL
```

Container startup can take up to ~30 s on a cold Docker pull; the 120 s
timeout shown above is a safe upper bound.

#### `runMigrations`

Applies per-context SQL migrations to a database. Takes the superuser URL
and an array of `{ name, migrationsDir }` descriptors.

```ts
import { runMigrations } from '@ods/test-kit';

await runMigrations(harness.connectionUrl, [
  { name: 'entries', migrationsDir: resolve(__dirname, '../infrastructure/migrations') },
  { name: 'sample',  migrationsDir: resolve(__dirname, '../../sample/src/infrastructure/migrations') },
]);
```

For each context the runner:
1. Creates the `migration_owner` role if absent; grants it to the current user.
2. Creates the context's schema as `migration_owner`.
3. Creates `<schema>._migrations` tracking table.
4. Applies `.sql` files from `migrationsDir` in lexicographic order, skipping
   already-applied files.

**Naming convention**: prefix files with a four-digit sequence number —
`0000_bootstrap.sql`, `0001_add_column.sql`, etc.

---

## Bounded-context anatomy

Every context in `packages/contexts/<name>/` follows this structure:

```
src/
  domain/          ← pure TypeScript — no ORM, no framework
    <aggregate>.ts     entity + repository interface
    domain-ids.ts      branded IDs local to this context (optional)
    domain-events.ts   event type definitions (optional)
  application/     ← use-cases (not yet in sample; add as needed)
  infrastructure/
    schema.ts          Drizzle table definitions (pgSchema('<name>'))
    drizzle-<x>-repository.ts   Drizzle implementation of the domain repository port
    migrations/
      0000_bootstrap.sql   schema, tables, RLS policies, outbox table
  __tests__/
    rls-isolation.integration.test.ts
    outbox.integration.test.ts
  index.ts         ← the context's public API surface
```

### Domain layer rules

- **No ORM imports** — `drizzle-orm` and `pg` are infrastructure concerns.
- **No `@ods/<context>` imports** — contexts never import each other. The
  boundary lint rule enforces this statically.
- `@ods/kernel` types (`TenantId`, `AccountId`, `DomainEvent`, etc.) are
  allowed in the domain layer.

### Infrastructure layer rules

- Drizzle schema uses `pgSchema('<name>')` so every table lives in its own
  PostgreSQL schema, matching the migrations.
- Repository implementations take a `pg.PoolClient` (not a `Pool`) — the
  caller (`withTransaction` / `withOutboxTransaction`) owns the connection.
- Drizzle is constructed from the client inside each repository method:
  `drizzle(client)`.

### `index.ts` — public surface

Export only what consuming code (application services, the composition root)
needs. Keep domain and infrastructure internals unexported.

```ts
export type { Entry, EntryRepository } from './domain/entry.js';
export { DrizzleEntryRepository } from './infrastructure/drizzle-entry-repository.js';
```

---

## Data ownership and RLS

See ADR-0005 for the full rationale. The short version:

Every table belongs to one of three **ownership scopes**:

| Scope       | Isolated by          | Who can read/write |
|-------------|----------------------|--------------------|
| `tenant`    | `tenant_id`          | One Club and its staff |
| `exhibitor` | `account_id`         | One dog owner, cross-club |
| `platform`  | _(no RLS policy)_    | Role-gated; platform admin or migration owner |

A **hybrid** table (e.g. `entries`) is Club-owned but visible to the Exhibitor
who submitted it:
```sql
CREATE POLICY entries_hybrid ON sample.entries
  AS PERMISSIVE FOR ALL TO app_user
  USING (
    tenant_id  = nullif(current_setting('app.tenant_id',  true), '')::uuid
    OR account_id = nullif(current_setting('app.account_id', true), '')::uuid
  );
```

The `nullif(…, '')::uuid` pattern is intentional: `withTransaction` sets
unused scope keys to an empty string (not `NULL`), so the cast must handle it
gracefully — an empty string casts to `NULL`, which matches no row.

**RLS is always `FORCE ROW LEVEL SECURITY`** on every app table, so even the
table owner is subject to policies when connecting as `app_user`. The
`migration_owner` role is exempt (it is the table owner), which is why
migrations run as `migration_owner`, not as `app_user`.

### Runtime database roles

| Role             | Purpose |
|------------------|---------|
| `migration_owner`| Owns all schemas and tables; runs DDL; RLS exempt |
| `app_user`       | Runtime application role; non-owner; RLS always enforced |

Application pools connect as `app_user`; `PostgresHarness.connectionUrl` is
the superuser URL used only for migrations and test data seeding.

---

## Boundary lint

`eslint-plugin-boundaries` enforces two invariants statically:

1. **No infra → kernel domain violation**: `domain/` files cannot import from
   `infrastructure/` within the same context.
2. **No cross-context imports**: `@ods/<context>` packages cannot be imported
   from inside another context's `domain/` or `infrastructure/` layers.
   `@ods/kernel` is the only cross-package import that is always allowed.

These rules are tested by `scripts/__tests__/boundary-lint.test.ts` — a
Vitest suite that lints virtual code snippets and asserts violations are
detected (or permitted). Run it with `pnpm test`.

---

## Adding a new bounded context

### 1. Scaffold

```sh
pnpm new:context
# Prompts: Context name (kebab-case, e.g. show-organisation)
```

This generates the full package skeleton under `packages/contexts/<name>/`
including `package.json`, `tsconfig.json`, domain stub, Drizzle schema,
repository, bootstrap migration, and integration test stubs.

After scaffolding, run `pnpm install` to link the new workspace package.

### 2. Rename the domain stub

The generator creates `src/domain/item.ts` with a placeholder `Item` entity.
Rename it and its repository interface to the actual aggregate name.

### 3. Write the bootstrap migration

Edit `src/infrastructure/migrations/0000_bootstrap.sql`. Use the RLS template
from `contexts/sample` as a guide — copy the policy block that matches your
table's ownership scope (`tenant`, `exhibitor`, or `hybrid`) and adjust the
table and policy names.

Every context's bootstrap migration must also create the outbox table:

```sql
CREATE TABLE IF NOT EXISTS <name>.outbox (
  seq            BIGSERIAL    PRIMARY KEY,
  event_id       UUID         NOT NULL UNIQUE,
  type           TEXT         NOT NULL,
  occurred_at    TIMESTAMPTZ  NOT NULL,
  scope          TEXT         NOT NULL,
  tenant_id      UUID,
  account_id     UUID,
  aggregate_id   TEXT         NOT NULL,
  payload        JSONB        NOT NULL,
  dispatched_at  TIMESTAMPTZ
);
```

### 4. Update the Drizzle schema

Edit `src/infrastructure/schema.ts`. Change `pgSchema('sample')` to
`pgSchema('<name>')` and define your tables to match the migration.

### 5. Implement the repository

Replace the placeholder `DrizzleItemRepository` with a real implementation.
The constructor takes a `pg.PoolClient`; always build the Drizzle instance from
that client, not from a pool.

### 6. Expose from `index.ts`

Add `export type` lines for the domain interfaces and `export` lines for the
infrastructure implementations.

### 7. Wire up in integration tests

The generated `outbox.integration.test.ts` and `rls-isolation.integration.test.ts`
already import `PostgresHarness` and `runMigrations`. Fill in the real entity,
IDs, and event types; the harness and migration runner work unchanged.

Run integration tests with:

```sh
pnpm vitest --config vitest.integration.config.ts
```

Docker must be running (Testcontainers requirement).

---

## End-to-end outbox flow

```
Application call
  └─ withOutboxTransaction(pool, scope, writer, async (client, outbox) => {
       // 1. BEGIN + SET LOCAL app.tenant_id / app.account_id
       repo.save(aggregate);          // 2. INSERT/UPDATE via Drizzle (RLS active)
       outbox.append(event);          // 3. accumulate in memory
       // 4. writer.write(client, events, scope)  → INSERT INTO <schema>.outbox
       // 5. COMMIT  ← aggregate change + outbox row land atomically
     })

PgPollingDispatcher.poll()
  └─ FOR UPDATE SKIP LOCKED on outbox WHERE dispatched_at IS NULL
       handler(event)                 // 6. deliver to subscriber
       UPDATE outbox SET dispatched_at = NOW()   // 7. mark dispatched
       COMMIT                         // 8. per-row transaction
```

Steps 1–5 are atomic: either both the aggregate row and the outbox row land, or
neither does. Steps 6–8 are at-least-once: if the process crashes between 7 and
8, the row is redelivered on the next poll cycle. Handlers must be idempotent
on `event.eventId`.
