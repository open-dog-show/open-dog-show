# Infrastructure foundation

Developer reference for the monorepo scaffold delivered in T1–T8.

> **Related docs**
> - ADR-0002 — bounded contexts and event-driven integration
> - ADR-0004 — tech stack rationale
> - ADR-0005 — data-ownership scopes and RLS
> - ADR-0006 — monorepo scaffolding and shared kernel
> - [`CONTEXT.md`](../CONTEXT.md) — ubiquitous language
> - [`CONTEXT-MAP.md`](../CONTEXT-MAP.md) — bounded-context relationships

---

## What this foundation is for

The platform is a **modular monolith** — nine bounded contexts deployed as one
process sharing a single PostgreSQL database. Each context is a separate
package with its own database schema; contexts never import each other's code;
they communicate only by emitting and consuming domain events.

This foundation exists to make three things true for every new context without
repeating the same boilerplate:

1. **Domain layer isolation.** Domain code (entities, value objects, repository
   interfaces) has zero dependencies on ORMs, HTTP frameworks, or databases.
   Infrastructure concerns live in a separate layer inside the same package.
2. **Correct multi-tenancy.** Every database query is automatically scoped to
   the acting party (Club, exhibitor, or platform operator) through PostgreSQL
   Row-Level Security, set once per transaction before any business logic runs.
3. **Durable event delivery.** Domain events are written to the database in the
   _same transaction_ as the aggregate change, so an event is never lost and a
   change is never unannounced — even if the process crashes mid-request.

These three concerns interact: a unit of work that saves an entity and emits
an event must set the RLS scope, run the domain logic, write the event to the
outbox, and commit — all as one atomic step. The `withOutboxTransaction` seam
is where they meet.

---

## Architecture: two axes

Bounded contexts provide the _vertical_ axis. Clean architecture layers provide
the _horizontal_ axis inside each context. Neither alone is sufficient: vertical
slices without layers muddle domain rules with SQL; layers without vertical
slices produce a monolithic "domain" shared by all contexts.

```
                     vertical axis (contexts)
              ┌──────────────┬──────────────┬────────┐
              │   entries    │    judging   │  ...   │
horizontal    ├──────────────┼──────────────┼────────┤
axis          │   domain/    │   domain/    │        │  ← pure TypeScript
(layers)      ├──────────────┼──────────────┼────────┤
              │ application/ │ application/ │        │  ← use-cases
              ├──────────────┼──────────────┼────────┤
              │infrastructure│infrastructure│        │  ← Drizzle, pg, migrations
              └──────────────┴──────────────┴────────┘
                                  ↑
                              @ods/kernel
                     (shared primitives; no infra)
```

Dependencies flow **inward**: `infrastructure → application → domain`. Nothing
in the domain layer may import from infrastructure. The boundary lint rules
enforce this statically at CI time.

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

Internal packages use `"noEmit": true` and live-source each other via `exports`
entries that point directly at `.ts` source files. There is **no build step**
for internal packages — a new context is immediately importable by others after
`pnpm install`. TypeScript resolves live source through `NodeNext` resolution
and the `allowImportingTsExtensions` flag. Only `apps/api` (the deployable)
needs to be compiled.

---

## `@ods/kernel`

The kernel is the shared-language layer across all contexts. It defines
primitives every domain uses, infrastructure helpers every context wires up
the same way, and test doubles for the ports it defines.

**Rule:** the kernel's `domain/` sub-folder must stay free of infrastructure
imports. `pg`, `drizzle-orm`, and third-party libraries belong in
`kernel/infrastructure/`. The split ensures domain code in _any_ context
remains ORM-free even when it imports from the kernel.

### Domain primitives

#### `DomainEvent<TPayload>`

Every context communicates with others through domain events. A `DomainEvent`
is a **fact** — something that happened in the past, immutable, with a payload
that records the relevant state change. It is not a command.

```ts
interface DomainEvent<TPayload> {
  eventId:     string;      // UUIDv4 — idempotency key for the dispatcher
  type:        string;      // context-prefixed, e.g. 'entries.EntrySubmitted'
  occurredAt:  Date;
  scope:       EventScope;  // 'tenant' | 'exhibitor' | 'platform'
  aggregateId: string;      // the root entity that changed
  payload:     TPayload;
}
```

`type` is a **context-prefixed dot-notation string** (`<context>.<EventName>`).
This is the schema-version key: when a payload shape changes incompatibly,
introduce a new type name rather than mutating the existing one.

`scope` records **who owns the fact**. It is distinct from `TransactionScope`
(who is _acting_) — see [TransactionScope](#transactionscope) and
[Data ownership and RLS](#data-ownership-and-rls).

`eventId` is UUIDv4, not UUIDv7 or ULID. ADR-0006 chose v4 deliberately: a
time-ordered identifier embeds a creation timestamp in externally-visible IDs,
which is an information leak. v4 is opaque.

**Always create events with the factory**, never with an object literal:

```ts
import { createDomainEvent } from '@ods/kernel';

const event = createDomainEvent(
  {
    type:        'entries.EntrySubmitted',
    scope:       'tenant',
    aggregateId: entryId,
    payload:     { dogName: 'Fido' },
  },
  { clock, idGenerator },
);
```

The factory fills `eventId` and `occurredAt` from the injected ports. This is
the reason those ports exist: without injection, `new Date()` and
`randomUUID()` are ambient globals that make events non-deterministic in tests.
With injection, a test using `FakeClock` and `FakeIdGenerator` gets
predictable, assertable events — and can advance time explicitly to exercise
time-dependent domain invariants.

#### `DomainEventCodec` — `encodeDomainEvent` / `decodeDomainEvent`

`DomainEvent` carries an `occurredAt: Date`; JSON has no Date type. The codec
converts between the runtime shape and `DomainEventJson`, where `occurredAt`
is an ISO-8601 string. `PgOutboxWriter` and `PgPollingDispatcher` use it
internally. Reach for it directly when serialising events over HTTP, writing
snapshot tests that compare raw JSON, or deserialising events arriving from a
future message broker.

```ts
import { encodeDomainEvent, decodeDomainEvent } from '@ods/kernel';

const json = encodeDomainEvent(event);           // → DomainEventJson
const back = decodeDomainEvent<MyPayload>(json); // → DomainEvent<MyPayload>
```

#### Branded domain IDs

IDs cross context boundaries as UUID strings. Without extra typing, nothing
stops application code from passing a `ShowId` where a `DogId` is expected —
both are `string` at runtime, so the mistake compiles and fails silently at the
database level.

Branded types add a compile-time tag enforced by the type checker:

```ts
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type ShowId = Brand<string, 'ShowId'>;
export const asShowId = (id: string): ShowId => id as ShowId;
```

At runtime a `ShowId` is still a plain string (zero overhead). The `as` cast
is only safe through the explicit constructor, which is the intended
boundary-crossing point — you cast an incoming raw string to a branded ID once
at the system edge, and the rest of the code is type-safe.

```ts
import { asShowId, asTenantId, type ShowId, type TenantId } from '@ods/kernel';

const showId: ShowId     = asShowId('00000000-…');
const tenantId: TenantId = asTenantId('00000000-…');
```

The kernel exports the cross-context IDs: `ShowId`, `DogId`, `TenantId`,
`ExhibitorId`, `AccountId`. Contexts define their own local IDs (e.g.
`EntryId`, `RingId`) in `src/domain/domain-ids.ts` using the same
`Brand<T, B>` pattern — copy it from the kernel source rather than adding
every new ID type to the kernel itself.

#### `Clock` and `IdGenerator` ports

Two minimal infrastructure ports, defined in the domain layer:

```ts
interface Clock       { now():      Date   }
interface IdGenerator { generate(): string }
```

This is ports-and-adapters applied at the smallest useful granularity. Without
injection, `new Date()` and `crypto.randomUUID()` are ambient globals that make
domain logic non-deterministic: different runs produce different timestamps and
different IDs, so tests become order-dependent and assertions become
cumbersome. With injection, replace both with test doubles and the entire
domain test suite runs hermetically — no system-clock or PRNG state can leak in.

| Scenario    | Implementation                               | Where wired |
|-------------|----------------------------------------------|-------------|
| Production  | `SystemClock`, `RandomIdGenerator`           | `apps/api` composition root |
| Unit tests  | `FakeClock`, `FakeIdGenerator`               | each test file |

#### `TransactionScope`

`TransactionScope` describes **who is acting** in a unit of work, so that the
transaction helper can set the correct PostgreSQL RLS session variables before
any SQL runs. It is a discriminated union with three variants:

```ts
type TransactionScope =
  | { kind: 'tenant';    tenantId: TenantId; accountId: AccountId }
  | { kind: 'exhibitor'; accountId: AccountId }
  | { kind: 'platform' };
```

| Kind        | `app.tenant_id` | `app.account_id` | Typical caller |
|-------------|-----------------|------------------|----------------|
| `tenant`    | Club UUID       | User UUID        | Show Secretary managing a show |
| `exhibitor` | _(empty)_       | User UUID        | Dog owner entering a show |
| `platform`  | _(empty)_       | _(empty)_        | Platform admin, background jobs |

`TransactionScope` is **not** the same as `EventScope` on a domain event. They
solve different problems:

- `TransactionScope` is an input — it controls which database rows the
  transaction may read or write (the RLS predicate at query time).
- `EventScope` is an output — it records the ownership classification of a
  fact that already happened, so downstream contexts can route it correctly.

A concrete example: an Exhibitor submits an Entry
(`TransactionScope.kind = 'exhibitor'`), but the Entry belongs to the Club's
show, so the domain event carries `scope: 'tenant'`. The RLS predicate during
that transaction must grant the exhibitor _write_ access to the `entries` table
(hybrid policy); the event's scope tells the dispatcher that this is Club-owned
data when routing. See [Data ownership and RLS](#data-ownership-and-rls) for
the full picture.

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

#### Why the transaction helpers exist

A naive approach to RLS would be: open a connection, run `SET app.tenant_id =
…`, then execute queries. This has two problems:

1. `SET` without `LOCAL` is session-scoped. On a pooled connection the setting
   survives to the next request — a Club A query can inherit Club B's
   `tenant_id` if the connection is reused without resetting.
2. The RLS variable and the outbox write are not coordinated with `COMMIT`. A
   crash between the aggregate write and the event write leaves the database
   inconsistent: either a change with no corresponding event, or an event for a
   change that was rolled back.

`withTransaction` and `withOutboxTransaction` solve both problems:

- They use `set_config(name, value, is_local := true)` — equivalent to
  `SET LOCAL` — so the RLS variables are **transaction-scoped** and vanish
  automatically on `COMMIT` or `ROLLBACK`. Connection reuse is safe.
- `withOutboxTransaction` writes events to the outbox table _inside the same
  database transaction_, so the aggregate change and the event are atomic.
  Either both land or neither does.

#### `withTransaction`

Use for units of work that **do not emit domain events**.

```ts
import { withTransaction } from '@ods/kernel';

const shows = await withTransaction(pool, scope, async (client) => {
  return new DrizzleShowRepository(client).findAll();
});
```

The callback receives a `pg.PoolClient` that is already inside an open
transaction with the correct RLS variables set. Pass it directly to Drizzle or
`client.query()` calls — do not open a second connection or begin a nested
transaction.

#### `withOutboxTransaction`

The outbox-aware variant. Use for writes that **emit domain events**. The
callback receives both the `pg.PoolClient` and an `OutboxAppender`. Events
appended during the callback are written to `<schema>.outbox` immediately
before `COMMIT`. If anything throws — including inside the event write itself
— the transaction rolls back and neither the aggregate row nor the outbox rows
reach the database.

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
same unit-of-work never creates duplicate outbox rows. This guarantee only
holds when the **same `DomainEvent` object** (with its original `eventId`) is
replayed — a freshly constructed event carries a new `eventId` and the
conflict guard offers no protection.

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

**Why polling and not `LISTEN/NOTIFY`?** PostgreSQL's `LISTEN/NOTIFY` is
lower-latency but notifications are **not durable** — they are lost if the
listener is disconnected when the `NOTIFY` fires. Because a reliable fallback
(polling) is always needed anyway, polling is the correct baseline. ADR-0006
explicitly defers `LISTEN/NOTIFY` as a future latency optimisation.

**`FOR UPDATE SKIP LOCKED`** is PostgreSQL's advisory lock for queue patterns:
multiple dispatcher instances running concurrently will never pick the same
row, but they also do not block each other. Each row is processed in its own
short transaction, so a handler failure rolls back only that row — previously
dispatched rows in the same batch are unaffected.

Construct with the pool, schema name, and handler:

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

- **At-least-once.** If the process crashes after the handler returns but
  before `dispatched_at` is committed, the row is redelivered on the next poll
  cycle. All handlers must be **idempotent on `event.eventId`** — processing
  the same event twice must produce the same outcome as processing it once.
  Typical patterns: `INSERT … ON CONFLICT (event_id) DO NOTHING`, or an upsert
  on the aggregate projection keyed by the event ID.
- **`FOR UPDATE SKIP LOCKED`** — concurrent dispatcher instances never process
  the same row.
- **Per-row transactions** — each row is committed or rolled back independently.
  A handler failure for row N does not affect rows 1..N−1 already dispatched.
- **Ordering** — rows are dispatched in `seq` (insertion) order within a
  context. There is no global ordering across contexts — a deliberate
  trade-off of the modular-monolith design.

#### `SystemClock` and `RandomIdGenerator`

Production implementations of the `Clock` and `IdGenerator` ports. Wire them
in at the composition root (`apps/api`).

```ts
import { SystemClock, RandomIdGenerator } from '@ods/kernel';
```

---

### Testing helpers

#### `FakeClock`

A controllable `Clock` for unit and integration tests. Starts at a given
timestamp (default: Unix epoch) and advances only when `tick()` is called.
This removes all ambient wall-clock non-determinism: two runs of the same test
always see the same timestamps, regardless of machine speed or time zone.

```ts
import { FakeClock } from '@ods/kernel';

const clock = new FakeClock(new Date('2026-08-01T12:00:00Z'));
// ... domain logic runs, assert timestamps ...
clock.tick(5_000); // advance 5 s for the next phase
```

#### `FakeIdGenerator`

A deterministic `IdGenerator` that produces valid UUID-shaped strings with an
incrementing numeric suffix. Useful when a test must assert on specific IDs or
verify that the correct ID was stored. The generated strings satisfy UUID
validation (`4` and `8` nibbles are fixed), so they pass any UUID format check
at the database or application boundary. `reset()` returns the sequence to its
starting seed.

```ts
import { FakeIdGenerator } from '@ods/kernel';

const idGen = new FakeIdGenerator(1);  // seed = 1
idGen.generate(); // → '00000000-0000-4000-8000-000000000001'
idGen.generate(); // → '00000000-0000-4000-8000-000000000002'
idGen.reset();    //   sequence returns to seed (1)
```

---

## `@ods/test-kit`

Integration tests for any context that touches a database require a real
PostgreSQL instance. The test-kit eliminates the boilerplate of spinning one up
and tearing it down, and ensures migrations are applied in the same way they
would be in production.

#### `PostgresHarness`

Starts a throwaway PostgreSQL container via Testcontainers. The container is
isolated per test suite and destroyed in `afterAll`, so no test file shares
database state with another.

```ts
import { PostgresHarness } from '@ods/test-kit';

const harness = new PostgresHarness();

beforeAll(async () => { await harness.start(); }, 120_000);
afterAll(async  () => { await harness.stop();  });

// harness.connectionUrl — postgresql://… superuser URL
```

Container startup takes a few seconds on a warm Docker image and up to ~30 s
on a cold pull. The 120 s `beforeAll` timeout shown above is a safe upper
bound for CI on a first run.

`connectionUrl` is the **superuser** URL. Use it only for migrations and test
data seeding. Application pools should connect as `app_user`
(see [Runtime database roles](#runtime-database-roles)).

#### `runMigrations`

Applies all pending SQL migrations for one or more contexts to a given
database. Run it once in `beforeAll`, before any context-level tests.

**Why a custom runner, not Drizzle Kit?** Drizzle Kit generates table DDL but
cannot model `CREATE SCHEMA`, role creation, or RLS policies. The hand-written
SQL in `0000_bootstrap.sql` covers the full setup; the runner just applies
migration files in order and tracks what has already been applied.

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

Every context in `packages/contexts/<name>/` follows this structure. The
`contexts/sample` package is the canonical reference — its tests pass, its
migration runs, and its RLS policies have been verified in integration.
When in doubt, copy from sample.

```
packages/contexts/<name>/
  package.json               name: "@ods/<name>", type: "module"
  tsconfig.json              extends root; NodeNext module + resolution
  src/
    domain/                  ← pure TypeScript — zero external dependencies
      <aggregate>.ts           entity type + repository interface
      domain-ids.ts            branded IDs local to this context (optional)
    application/             ← use-cases (not yet in sample; add when needed)
    infrastructure/          ← all framework/ORM/database code lives here
      schema.ts                Drizzle table definitions (pgSchema('<name>'))
      drizzle-<x>-repository.ts  Drizzle implementation of the domain port
      migrations/
        0000_bootstrap.sql     schema, roles, tables, RLS policies, outbox table
    __tests__/
      rls-isolation.integration.test.ts
      outbox.integration.test.ts
    index.ts                 ← the context's public API surface
```

### Domain layer

The domain layer must have **no external dependencies** — no `pg`, no
`drizzle-orm`, no HTTP clients. It may only import:
- `@ods/kernel` types (`TenantId`, `AccountId`, `DomainEvent`, ports).
- Other files within the same context's `domain/` folder.

The only things defined here are:

- **Entity types** — plain TypeScript interfaces or classes describing the
  aggregate root and its state.
- **Repository interfaces** — narrow, aggregate-specific ports
  (`EntryRepository { findById; save }`) expressed in domain terms, not SQL.
  Avoid a generic `Repository<T>` base — it exposes a CRUD surface that leaks
  persistence concerns into the domain and couples the interface to
  implementation details of the adapter.
- **Domain event payload types** — TypeScript payload types, co-located with
  the aggregate they describe.

```ts
// src/domain/entry.ts
export interface Entry {
  readonly id:        string;
  readonly tenantId:  TenantId;
  readonly accountId: AccountId;
  readonly showId:    string;
  readonly dogName:   string;
}

export interface EntryRepository {
  findAll(): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
}
```

### Infrastructure layer

The infrastructure layer _implements_ the domain's repository interfaces using
Drizzle and `pg`. Key conventions:

- **Drizzle schema uses `pgSchema('<name>')`** so every table is in its own
  PostgreSQL schema, matching the migration and keeping tables from different
  contexts isolated even in a shared database.
- **Repository constructors take a `pg.PoolClient`**, not a `pg.Pool`. The
  caller (`withTransaction` / `withOutboxTransaction`) owns the connection and
  the transaction lifetime. The repository is a pure data-access adapter.
- **Build Drizzle from the client**: `this.db = drizzle(client)`. A Drizzle
  instance wraps a single connection; building it from a pool would bypass the
  active transaction and the already-set RLS session variables.

```ts
export class DrizzleEntryRepository implements EntryRepository {
  private readonly db;
  constructor(client: pg.PoolClient) { this.db = drizzle(client); }

  async save(entry: Entry): Promise<void> {
    await this.db
      .insert(entriesTable).values(entry)
      .onConflictDoUpdate({ target: entriesTable.id, set: { dogName: entry.dogName } });
  }
}
```

### `index.ts` — public surface

The `index.ts` is the context's published API. Everything the composition root
or integration tests need must be exported here; all other files are private
implementation details. Module resolution goes through `package.json`
`"exports"`, which points only at `index.ts` — other packages cannot reach
into `src/domain/` or `src/infrastructure/` directly.

```ts
export type { Entry, EntryRepository } from './domain/entry.js';
export      { DrizzleEntryRepository } from './infrastructure/drizzle-entry-repository.js';
```

---

## Data ownership and RLS

### The problem with a single `tenant_id`

ADR-0004 initially said “row-level `tenant_id` + RLS on every table.” The
domain pushed back. The platform has three distinct kinds of data:

1. **Club-owned** — Shows, rings, results. A tenant is a Club; this data must
   be invisible to other Clubs.
2. **Exhibitor-owned** — Dogs, Ownerships, Titles. A dog owner enters the same
   dog into shows run by different Clubs. This data cannot be owned by one
   Club; it must be accessible cross-tenant.
3. **Platform-owned** — Rulesets, the Ruleset Catalog, Users. No Club owns
   this reference data.

A uniform `tenant_id` key cannot express these three shapes. Copying a Dog per
Club would destroy the “one durable Dog identity reused across Entries”
invariant. Application-level filtering instead of RLS was also rejected: one
missed `WHERE` clause becomes a cross-tenant data leak. The solution is
**scope-per-table** with PostgreSQL RLS enforced at the database level, which
provides defence-in-depth even if application code has a bug.

### Three ownership scopes

| Scope       | RLS key       | Examples |
|-------------|---------------|----------|
| `tenant`    | `tenant_id`   | Shows, rings, classes, ring results |
| `exhibitor` | `account_id`  | Dogs, Ownerships, Titles |
| `platform`  | _(exempt)_    | Rulesets, Ruleset Catalog, Users |

**Hybrid tables** are Club-owned but must also be readable by the Exhibitor
who created the row. An `Entry` belongs to the Club's show but was submitted
by the Exhibitor; both parties must be able to read it. The RLS predicate uses
a disjunction:

```sql
CREATE POLICY entries_hybrid ON entries.entries
  AS PERMISSIVE FOR ALL TO app_user
  USING (
    tenant_id  = nullif(current_setting('app.tenant_id',  true), '')::uuid
    OR account_id = nullif(current_setting('app.account_id', true), '')::uuid
  );
```

### The `nullif(…, '')::uuid` pattern

`withTransaction` sets unused scope keys to an **empty string**, not `NULL`,
because `set_config()` only accepts text. A bare `::uuid` cast would throw on
an empty string and break all queries for a `platform`-scoped transaction.
`nullif(…, '')` converts the empty string to `NULL` first; `NULL::uuid` is
`NULL`; and `tenant_id = NULL` evaluates to `NULL` (not `TRUE`) in SQL, so
no rows match — which is the correct behaviour (a platform-scoped transaction
should not see tenant-scoped rows).

### Why `FORCE ROW LEVEL SECURITY`

PostgreSQL bypasses RLS for the table owner. Tables are created as
`migration_owner`, which means code running _as_ `migration_owner` sees all
rows regardless of policies. `FORCE ROW LEVEL SECURITY` overrides this — even
the owner is subject to policies when connecting as a non-superuser role.
Application code connects as `app_user` (a non-owner), so policies are always
active. The migration runner connects as the superuser specifically to be exempt
from RLS during schema setup and test data seeding.

### Why `SET LOCAL`

The session variables are set with `set_config(name, value, is_local := true)`,
equivalent to `SET LOCAL` — the setting is transaction-scoped and reverts
automatically on `COMMIT` or `ROLLBACK`. Setting them session-wide would leak
the previous user’s scope into the next request on a pooled connection.
`SET LOCAL` inside a transaction is the only safe pattern.

### Runtime database roles

| Role             | Purpose | RLS status |
|------------------|---------|------------|
| `migration_owner`| Owns all schemas/tables; runs DDL | Exempt (table owner) |
| `app_user`       | Runtime application role | Always enforced |

Application pools must connect as `app_user`. Do not use the superuser URL in
application pools. In tests, derive the `app_user` URL from the harness URL:

```ts
const appUserUrl = harness.connectionUrl.replace(
  /\/\/[^:]+:[^@]+@/,
  '//app_user:app_user@',
);
const appPool = new pg.Pool({ connectionString: appUserUrl });
```

---

## Boundary lint

### Why it exists

Contexts in a modular monolith have _physical_ access to each other’s source
files, even though they must not _logically_ depend on each other. Without a
guardrail, a convenience import can couple two contexts undetected until a
requirement to deploy or test them independently breaks. The boundary lint
rules turn that mistake into a CI failure, not a code-review catch.

`eslint-plugin-boundaries` enforces two invariants statically:

1. **Layer rule (inward-only)** — `domain/` files cannot import from
   `infrastructure/` in the same context. Application layer cannot import from
   infrastructure. Violations are reported as `boundaries/dependencies` errors.

2. **Context-zone rule (no cross-context imports)** — `@ods/<context>`
   packages cannot be imported from inside another context’s `domain/` or
   `infrastructure/` layers. `@ods/kernel` is the only cross-context package
   import that is always permitted. When a context genuinely needs to react to
   another context’s events, it does so through the dispatcher’s
   `EventHandler` callback — not by importing the other context’s types.

`scripts/__tests__/boundary-lint.test.ts` lints virtual code snippets against
the real ESLint config and asserts that violations are detected (and permitted
imports are clean). This proves the _rule configuration_ is correct, not just
that existing code happens to comply. Run with `pnpm test`.

---

## Adding a new bounded context

### 1. Scaffold

```sh
pnpm new:context
# → Context name (kebab-case, e.g. show-organisation):
```

The generator (`plop`) creates the full package skeleton under
`packages/contexts/<name>/`, including `package.json`, `tsconfig.json`, a
domain stub (`item.ts`), Drizzle schema, a repository stub,
`0000_bootstrap.sql`, and both integration test stubs.

After scaffolding:

```sh
pnpm install   # link the new workspace package
pnpm typecheck # verify the skeleton compiles
```

The generated integration tests run against a real database and must pass
before any domain logic is written. This is the acceptance criterion: a
new context _boots_.

### 2. Rename the domain stub

The generator creates `src/domain/item.ts` with a placeholder `Item` entity
and `ItemRepository` interface. Rename both to the actual aggregate name (e.g.
`Entry` / `EntryRepository`), update the Drizzle repository accordingly, and
re-export from `index.ts`.

### 3. Write the bootstrap migration

Edit `src/infrastructure/migrations/0000_bootstrap.sql`. Use
`contexts/sample/src/infrastructure/migrations/0000_bootstrap.sql` as the
reference — it contains commented RLS policy templates for all three scope
kinds. Copy the block that matches each table’s ownership scope (`tenant`,
`exhibitor`, or `hybrid`), replace `sample.` with your context’s schema name,
and adjust the table and policy names.

Every bootstrap migration must create the outbox table:

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

GRANT SELECT, INSERT, UPDATE ON <name>.outbox TO app_user;
GRANT USAGE, SELECT ON SEQUENCE <name>.outbox_seq_seq TO app_user;
```

### 4. Update the Drizzle schema

Edit `src/infrastructure/schema.ts`. Change `pgSchema('sample')` to
`pgSchema('<name>')` and define your tables to mirror the migration. Keep the
TypeScript schema and the SQL migration in sync — Drizzle is not used in
auto-migrate mode; the SQL migration is the source of truth.

### 5. Implement the repository

Replace the placeholder `DrizzleItemRepository` with a real implementation.
The constructor takes a `pg.PoolClient` (not a `pg.Pool`). Build Drizzle from
the client: `this.db = drizzle(client)`.

### 6. Expose from `index.ts`

```ts
export type { Entry, EntryRepository }  from './domain/entry.js';
export      { DrizzleEntryRepository }  from './infrastructure/drizzle-entry-repository.js';
```

### 7. Fill in integration tests

The generated tests already set up the harness, run migrations, and have
skeleton test bodies. Fill in the real entity, IDs, and event types.

The outbox test should verify the full round-trip:
1. Call `withOutboxTransaction`, save an entity, and append an event.
2. Call `dispatcher.poll()`.
3. Assert the handler received the expected event with the correct payload.

Run integration tests (Docker must be running):

```sh
pnpm vitest --config vitest.integration.config.ts
```

---

## End-to-end outbox flow

Understanding the full lifecycle of a write that produces an event helps when
debugging unexpected delivery behaviour.

```
HTTP request / use-case call
  │
  └─ withOutboxTransaction(appPool, scope, writer, async (client, outbox) => {
       │
       ├─ BEGIN
       ├─ SET LOCAL app.tenant_id  = '<uuid>'   ← RLS active from here
       ├─ SET LOCAL app.account_id = '<uuid>'
       │
       ├─ repo.save(aggregate)                  ← INSERT/UPDATE (RLS filters)
       └─ outbox.append(event)                  ← accumulates in memory
     })                                         ← callback returns; framework takes over
       │
       ├─ writer.write(client, [event], scope)  ← INSERT INTO <schema>.outbox
       └─ COMMIT                                ← aggregate + outbox row atomic
         │
         │   ← process may crash here: outbox row is pending, will be redelivered
       │
PgPollingDispatcher.poll()
  │
  └─ BEGIN
       SELECT … FROM <schema>.outbox
         WHERE dispatched_at IS NULL
         ORDER BY seq
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       handler(event)                            ← must be idempotent on eventId
       UPDATE outbox SET dispatched_at = NOW()
     COMMIT
```

**The atomic guarantee.** The aggregate change and the outbox row land in a
single PostgreSQL transaction. There is no window where a change exists without
a corresponding pending event, or an event exists for a change that was rolled
back.

**The at-least-once guarantee.** After the write `COMMIT`, the outbox row is
visible to the dispatcher. If the process crashes between the handler returning
and `dispatched_at` being committed, the row is redelivered on the next poll
cycle. Every handler must be **idempotent on `event.eventId`**.

Common idempotency patterns:

| Pattern | When to use |
|---------|-------------|
| `INSERT … ON CONFLICT (event_id) DO NOTHING` on a tracking table | Events that trigger a side-effect which has its own ID |
| Upsert on the projection keyed by `aggregateId` | Read-model updates that are fully derived from the event payload |
| Natural idempotency | Projections that recompute the same value regardless of how many times they run |
