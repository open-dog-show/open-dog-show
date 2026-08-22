# Splitting @ods/kernel's Postgres infrastructure into a dedicated package

The kernel's Postgres infrastructure (`withTransaction`, `withOutboxTransaction`,
`PgOutboxWriter`, `PgPollingDispatcher`, `SystemClock`, `RandomIdGenerator`) stays
in `@ods/kernel`. It is **not** split into a dedicated `@ods/kernel-pg` (or similar)
package.

## Why this is out of scope

ADR-0006 (*Monorepo scaffolding and shared-kernel foundation*) deliberately houses
the shared transactional-outbox scaffolding and the `Clock` / `IdGenerator`
production implementations in `@ods/kernel`. The kernel is the single home of the
unit-of-work seam (`withTransaction` / `withOutboxTransaction`) that sets the RLS
session variables and writes the outbox row in the same transaction as the domain
change (ADR-0005). Splitting the Postgres machinery into its own package would
fragment that seam and add a package boundary with no current payoff.

The DDD-review finding that prompted this request came from a **wording
contradiction**, not a structural defect: `.github/copilot-instructions.md`
described the kernel as "domain primitives only, no infra" while ADR-0006 endorses
it holding the shared outbox scaffolding. That contradiction is resolved by
amending the doc to match the ADR (issue #93), not by moving code.

The coupling the split would relieve is also mild today. The kernel's infrastructure
uses type-only `pg` imports, and `@types/pg` is a devDependency — consumers of the
kernel's domain primitives (`DomainEvent`, the branded ids, the `Clock` /
`IdGenerator` ports) do not pull `pg` at runtime, only into the type-check graph.
No bounded context currently needs the kernel's domain primitives with zero `pg`
type dependency, and there is no typecheck or build pain to relieve.

The inward-layering rule is preserved either way: the kernel's `domain/` layer has
no `pg` / ORM imports (boundary-lint enforced), and all Postgres code stays under
`infrastructure/`. Splitting the package would not improve that separation; it
would only relocate it.

## When to reconsider

Reopen this if a concrete trigger appears: a bounded context that wants the kernel's
domain primitives with zero `pg` type dependency, or typecheck / build times that
make separating the heavy `pg`-typed graph worthwhile. The `processOne` decomposition
landed in #90 keeps a future extraction option open. Related architecture candidates
already in the tracker (#46 — OutboxReader seam; #47 — EventFactory port) are
orthogonal and can proceed independently.

## Prior requests

- #91 — "triage: split @ods/kernel Postgres infrastructure into @ods/kernel-pg"
  (strategic finding from the `/ddd-review` of `@ods/kernel` on branch
  `88-improve-the-code-of-package-2`; recorded as out-of-scope in #90)