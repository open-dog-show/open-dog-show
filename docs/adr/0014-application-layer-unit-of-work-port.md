---
status: accepted
---

# Application-layer UnitOfWork port

> Fills in the `src/application/` layer that [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md)
> declares ("use-cases; depends on domain only") but leaves unspecified. Records
> _how_ use cases hide the transaction / repository / outbox wiring. Originated
> from issue #120 (architecture-review finding: "introduce an application-layer
> use case in the context generator/sample").

## Context

ADR-0006 fixes a two-axis package structure: bounded contexts (vertical) and
clean-architecture layers (horizontal `domain/`, `application/`,
`infrastructure/`). The ESLint boundary config (`eslint.config.js`) already
defines a `context-application` element with its own dependency policy (may
import same-context `domain/` + `@ods/kernel`) and allows `context-infrastructure`
to import from `context-application`.

**But no context has an `application/` folder**, and the plop context
generator does not stamp one. Every write action is wired inline at each call
site (currently the integration tests, since `apps/api` does not exist yet):

```ts
await withOutboxTransaction(appPool, scope, writer, async (client, outbox) => {
    const repo = new DrizzleEntryRepository(client); // wired here
    await repo.save(entry); // wired here
    outbox.append(makeEvent()); // wired here
});
```

This stacks two friction patterns:

- **Screaming-architecture violation** the structure reveals a missing layer
  the ADR promises.
- **Dependency-inversion leak** the repository constructor takes a
  `pg.PoolClient`, so the caller must open the transaction first and `new` the
  repo inside it. The transaction-management concern leaks upward.

The real bugs (wrong `TransactionScope`, a forgotten outbox append, a repo built
outside the transaction, a wrong `EventType`) have **no locality**: they hide in
the wiring, which lives in N call sites and N tests. The plop template is the
highest-leverage fix point stamping the deep shape _before_ the real contexts
are generated pays forward N times; doing it after means re-writing N contexts.

## Decision

Introduce a thin **per-context `UnitOfWork` port** in `domain/`, a **class-based
use case** in `application/`, and a **`PgXxxUnitOfWork` implementation** in
`infrastructure/`. The application layer never names `pg`, `pg.PoolClient`,
`OutboxWriter`, or `withOutboxTransaction` the deepest dependency inversion
that keeps the ADR-0001 / ADR-0006 ORM-free domain invariant and makes the use
case trivially unit-testable without Docker.

### The port (per context, `domain/unit-of-work.ts`)

Each context domain layer owns a `UnitOfWork` port that explicitly lists its
repositories alongside event appending:

```ts
export interface SampleUnitOfWork {
    run<T>(scope: TransactionScope, body: (ctx: SampleUnitOfWorkContext) => Promise<T>): Promise<T>;
}

export interface SampleUnitOfWorkContext {
    readonly entries: EntryRepository; // the repos this context owns
    readonly shows: ShowRepository;
    appendEvents(...events: DomainEvent[]): void;
}
```

The port depends on domain (its own repository interfaces) and `@ods/kernel`
(`TransactionScope`, `DomainEvent`) exactly what `context-application` and
`context-domain` are allowed to import.

### The use case (`application/<verb>-<aggregate>.ts`)

A class whose constructor takes the `UnitOfWork` port plus the kernel ports it
needs (`Clock`, `EventIdGenerator`); whose method takes the domain input and
the `TransactionScope` separately (the scope is _who is acting_ RLS, not
domain data):

```ts
export class SaveEntryUseCase {
  constructor(
    private readonly unitOfWork: SampleUnitOfWork,
    private readonly clock: Clock,
    private readonly eventIdGenerator: EventIdGenerator,
  ) {}

  async execute(input: SaveEntryInput, scope: TransactionScope): Promise<void> {
    await this.unitOfWork.run(scope, async (ctx) => {
      const entry = /* domain logic: construct Entry from input + scope */;
      await ctx.entries.save(entry);
      ctx.appendEvents(createDomainEvent({ /* ... */ }, { clock: this.clock, eventIdGenerator: this.eventIdGenerator }));
    });
  }
}
```

### The implementation (`infrastructure/pg-unit-of-work.ts`)

`PgXxxUnitOfWork` wraps the kernel `withOutboxTransaction`, constructs the
Drizzle repositories inside the transaction, and exposes them through the
`UnitOfWorkContext`:

```ts
export class PgSampleUnitOfWork implements SampleUnitOfWork {
    constructor(
        private readonly pool: pg.Pool,
        private readonly writer: OutboxWriter,
    ) {}

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return withOutboxTransaction(this.pool, scope, this.writer, async (client, outbox) => {
            const ctx: SampleUnitOfWorkContext = {
                entries: new DrizzleEntryRepository(client),
                shows: new DrizzleShowRepository(client),
                appendEvents: (...events) => outbox.append(...events),
            };
            return body(ctx);
        });
    }
}
```

`UnitOfWork.run` wraps `withOutboxTransaction` (not `withTransaction`): read-only
operations simply do not call `ctx.appendEvents`, so the outbox write is skipped
(the kernel only writes when `pending.length > 0`). The `OutboxWriter` is a
constructor dep of `PgXxxUnitOfWork` but is only invoked when events are
appended; read-only calls pay only the cost of an empty pending array.

### The plop template

The context generator stamps the complete deep shape with a single `Item`
aggregate:

- `domain/unit-of-work.ts` `ItemUnitOfWork` + `ItemUnitOfWorkContext`
- `application/save-item.ts` `SaveItemUseCase`
- `infrastructure/pg-unit-of-work.ts` `PgItemUnitOfWork`
- updated `index.ts` exports the use case, the port (type), and the impl
- a use-case unit test (fake `UnitOfWork`, no Docker)

Every new context boots with the full pattern; the context author replicates it
per aggregate action.

### Test migration

The existing integration tests that do inline wiring migrate to `PgXxxUnitOfWork`:

- **`outbox.integration.test.ts`** the "transactional write" block uses
  `PgXxxUnitOfWork.run(scope, async (ctx) => { ctx.entries.save(entry); ctx.appendEvents(event); })`
  instead of raw `withOutboxTransaction` + `new DrizzleEntryRepository(client)`.
  The **dispatcher tests** stay raw they seed outbox rows via SQL and poll
  (read side), which has no write-path wiring to migrate.
- **`rls-isolation.integration.test.ts`** every test uses `PgXxxUnitOfWork.run`
  instead of raw `withTransaction` + `new DrizzleXxxRepository(client)`. The RLS
  behaviour is identical (`withOutboxTransaction` sets the same session vars).
- A new **unit test** exercises the use case with a fake `UnitOfWork` no
  Docker, fast, testing the domain logic + event creation in isolation.

## Considered options

- **Generic `UnitOfWork` in `@ods/kernel`** with a `ctx.repository<T>(port): T`
  runtime lookup rejected: erases which repos a context has at compile time;
  the per-context port is a few lines of type declaration that speaks the
  context language and is fully type-safe. The kernel stays at the primitive
  level (`withOutboxTransaction`, `OutboxAppender`, `TransactionScope`).

- **Use case owns the transaction via a kernel-re-exported `pg.Pool` type**
  rejected: smuggles `pg` types through the kernel to satisfy a lint rule rather
  than actually inverting the dependency. The use case would still need to
  `new` the repo from a `pg.PoolClient`, keeping the transaction concern in the
  application layer.

- **Use case receives an already-open transaction** rejected: the caller
  still writes `withOutboxTransaction(...)`, which is exactly the inline wiring
  the issue calls out. Does not hide the transaction boundary.

- **Bare function / factory function instead of a class** rejected: a class
  makes the port dependencies explicit and discoverable in the constructor;
  composes cleanly at the `apps/api` root; the plop template stamps one class
  per aggregate action as the clearest worked example.

## Consequences

- Each context gains ~3 new files (`domain/unit-of-work.ts`,
  `application/<use-case>.ts`, `infrastructure/pg-unit-of-work.ts`) plus a unit
  test. The plop template stamps all of them so the cost is paid once.
- The application layer (`context-application`) is now exercised by the ESLint
  boundary rules that were already defined but had no files to check.
- `apps/api` (the future composition root) will construct `PgXxxUnitOfWork`
  (pool + writer) and inject it into use case classes the wiring lives in one
  place, not N call sites.
- The kernel is untouched `withOutboxTransaction` / `withTransaction` /
  `OutboxAppender` / `TransactionScope` stay as the deep primitives.
- Read-only operations through `PgXxxUnitOfWork` use `withOutboxTransaction`
  (which sets up an unused pending array) rather than `withTransaction`. The
  overhead is negligible (one empty array); the benefit is a single `run` method
  rather than two.
