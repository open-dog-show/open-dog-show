---
status: accepted
---

# Aggregate roots record events as facts; the unit of work stamps the envelope; `EventScope` carries owner ids

> Decided in #184; implemented by #186 (kernel) and #188 (generators). Supersedes the
> architecture candidate #47 (`EventFactory` port). Amends
> [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md) (outbox columns),
> [ADR-0014](0014-application-layer-unit-of-work-port.md) (`appendEvents`),
> [ADR-0023](0023-variant-scope-value-objects-as-class-based-variant-value-objects.md) and
> [ADR-0024](0024-class-aggregate-correlated-field-invariant-per-role-factories.md)
> (`EventScope` shape).

## Context

- **Event construction needs infrastructure ports.** A domain event class carried
  `eventId`, `type`, `occurredAt`, `scope`, `aggregateId` and `payload`, so constructing one
  required `Clock` and `EventIdGenerator`. Aggregates hold neither, so use cases built the
  events (`EntrySubmitted.from(..., { clock, eventIdGenerator })`) and called
  `ctx.appendEvents`. That contradicts the harness ("recorded by the root"), and a mutating
  use case could forget its event.
- **The outbox owner columns come from the wrong place.** ADR-0006 flattens the event scope
  into the outbox (`scope`, nullable `club_id`/`user_id`) "so a dispatcher can route in
  SQL". After `EventScope` became kind-only, `PgOutboxWriter` filled `club_id`/`user_id`
  from the `TransactionScope` instead. An exhibitor-acting transaction that records a
  Club-owned fact wrote `scope = 'club'` with `club_id = null`, invisible to any Club-keyed
  routing.

## Decision

- **Roots record facts.** The kernel provides `AggregateRoot` with
  `protected record(event)` and `pullEvents()`. A root constructs an event from domain data
  only, e.g. `this.record(new ItemRenamed(this.id, name, EventScope.club(this.clubId)))`.
  The event class fixes its `type`.
- **The unit of work stamps the envelope.** When a use case passes an aggregate to
  `add`/`update`, the Postgres unit of work pulls its events and stamps `eventId` and
  `occurredAt` from the `Clock` and `EventIdGenerator` injected at the composition root. It
  writes them to the outbox in the same transaction before `COMMIT`. The kernel keeps the
  _fact_ (type, scope, aggregateId, payload) separate from the _stored envelope_ (eventId,
  occurredAt); the codec and dispatcher work on the envelope.
- **Use cases never touch events.** `ctx.appendEvents` and the use-case
  `Clock`/`EventIdGenerator` dependencies are removed.
- **`EventScope` carries owner ids again**, as a variant value object in the ADR-0023
  style: `EventScope.club(clubId)`, `EventScope.exhibitor(principalId)`,
  `EventScope.platform()`. A hybrid aggregate's events are `club(clubId)`, because ADR-0005
  gives each row one ownership scope and a wider read predicate.
- **The outbox owner columns come from `event.scope`.** `PgOutboxWriter.write` no longer
  takes a `TransactionScope`. `OutboxAppender` and the single-implementation `OutboxWriter`
  interface are removed.

## Considered options

- **Pass an `EventFactory` port into every mutating domain method (#47)**: rejected. Every
  changing method carries a plumbing parameter, and forgetting an event stays possible.
- **Keep use-case-built events**: rejected. The review findings stay open, and a forgotten
  event stays possible.
- **Drop `club_id`/`user_id` from the outbox**: rejected. It silently abandons ADR-0006's
  routing and NATS-subject intent.
- **Redefine the columns as "acting identity" from `TransactionScope`**: rejected. Nothing
  would record ownership for routing.

## Consequences

- `eventId`/`occurredAt` are assigned at `add`/`update` time within the transaction rather
  than at mutation time. The difference is immaterial inside one unit of work.
- The codec, rehydration registry, dispatcher and every event class change shape in one
  kernel migration (#186).
- **Idempotency changes scope, not strength.** Each event is stamped once, at `add`/`update`, and keeps that
  envelope for the rest of the transaction attempt, so re-running the outbox write within the attempt reuses
  its `eventId` and `ON CONFLICT (event_id)` still deduplicates. Re-running the unit-of-work **body** (a caller
  retry) re-records the facts with new ids, so body replays are **not** idempotent at the outbox. That is also
  true today, where the use case builds a fresh event on every run. A rolled-back attempt writes no rows. A
  caller retry after an ambiguous commit can duplicate a fact, and consumers must tolerate that (at-least-once,
  ADR-0006). #186 updates the `PgOutboxWriter` doc comment to match.
