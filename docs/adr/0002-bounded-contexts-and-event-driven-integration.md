---
status: accepted
---

# Bounded contexts and event-driven integration

> **Amended 2026-07-29:** The **Titles** context was removed — a Title is owner-asserted data on the Dog (Entries & Registration), not a computed/confirmed context. Nine contexts remain.

## Context

The domain (see [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md)) spans rule interpretation, entries, judging, titling, publishing, payments, and accounts — areas with different lifecycles, consistency boundaries, and rates of change. We need explicit boundaries so the differentiated core stays clean and the generic parts stay swappable, consistent with DDD + clean architecture.

## Decision

Nine bounded contexts, strategically classified:

- **Core:** Rulesets, Entries & Registration, Judging & Results.
- **Supporting:** Show Organisation, Catalogue & Publishing, Platform Administration.
- **Generic:** Payments, Identity & Access.
- **Fog (deferred):** Membership.

**Platform Administration** is the platform operator's cross-club back office: it onboards Clubs (tenants) and curates the `Ruleset Catalog` (which rulesets/versions are installed and available to Shows). It is upstream to Show Organisation and Rulesets; its principal role is the `Platform Administrator`.

**Integration is via domain events + reference-by-ID.** Contexts do not share mutable entities or reach into each other's databases; they publish facts (`ShowOpened`, `EntriesClosed`, `EntryPaid`, `ClassJudged`, `AwardGranted`, `TitleConfirmed`) and hold only foreign ids.

**Specific relationship patterns:**

- **Rulesets is an upstream Published Language**; all other contexts are **Conformist** to the `Effective Ruleset` shapes and policy-port interfaces (ADR-0001). Rulesets depends on no consumer.
- **Payments** and **Identity & Access** are generic and sit behind **anticorruption layers** to an external payment provider and identity provider respectively.
- **Show Organisation** is upstream to Entries, Judging, and Catalogue (a Show must exist first).
- **Titles are not a context.** A Title is **owner-asserted** data on the Dog (Entries & Registration); the platform stores but never computes or confirms Titles (authoritative confirmation is external, NCO/FCI).

## Considered options

- **One monolithic domain model** — rejected: collapses per-show results and cross-show titling, and welds generic payments/auth into the core.
- **Shared database / shared entities across contexts** — rejected: couples lifecycles and breaks the "portable, club-owned data" goal.
- **Bounded contexts + event-driven integration** — chosen: keeps the core differentiated and testable, generic contexts swappable, and matches the event-friendly nature of the domain (a show is a stream of facts).

## Consequences

- Each context is independently modelled, tested, and (later) deployable; the core never imports Payments/IdP SDKs.
- Requires an event-carrying mechanism and eventual-consistency handling between contexts.
- The Rulesets Published Language becomes a versioned contract — changing it is a deliberate, coordinated act (mitigated by the `Effective Ruleset` snapshot per Show from ADR-0001).
- **Catalogue & Publishing** is a read-model-heavy consumer of events, which suits live and post-show results publication.
