---
status: accepted
---

# Tech stack: TypeScript modular monolith, API-first with a WordPress connector, on PostgreSQL

> **Amended 2026-08-01:** The persistence decision's "row-level `tenant_id` + RLS applied inside each context schema" is refined by [ADR-0005](0005-data-ownership-scopes-and-rls-keys.md): isolation is **scope-per-table** (tenant / exhibitor / global), not a uniform `tenant_id` on every table. The concrete scaffolding is recorded in [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md).

## Context

ADRs 0001–0003 fixed the _shape_ of the system (data-first composable rulesets, nine event-integrated bounded contexts, AGPL-3.0) but left the technology stack open, under one standing constraint — **framework-agnostic, "don't marry the framework"** — plus the product goal of **keeping the cost of running a show low for small clubs** (README) and a later-added goal of **integrating with a club's existing website / CMS**.

The choice was worked through in a grilling session backed by a research note (issue #10, branch `research/adr-0004-language-integration`, `docs/research/adr-0004-language-integration.md`). Four coupled decisions had to be made together: language/runtime, repository topology, the event backbone, and persistence.

## Decision

**1. Language & product shape — TypeScript/Node, API-first ("Model A"), with a thin WordPress connector ("Shape 1").**

- The platform is a **standalone application** exposing an **HTTP/JSON API** plus **embeddable JavaScript widgets** and **iframe/oEmbed** for website integration. It is **not** shipped as an in-process CMS plugin.
- Website/CMS integration is delivered by a **thin WordPress connector plugin** that is a _pure adapter_ — a shortcode/block/embed that calls the API and holds **no domain logic**.
- **TypeScript/Node** is the language for the app and API. The deciding factor: in Model A the front end is JavaScript regardless of backend, and TypeScript uniquely lets **one set of type contracts be shared across the browser widgets and the API**, keeping the ADR-0001 pure core in the same language as the UI.
- **Deployment:** the **multi-tenant hosted instance is the primary channel**; **single-tenant** deployment (self-hosted, or hosted-by-us for one club) is a first-class supported mode — the same code run as one tenant, fronted by the same thin connector. This preserves ADR-0001 (pure core) and ADR-0002 (multi-tenant).

**2. Repository topology — monorepo; connector separate.**

- A **monorepo** (pnpm workspaces): each of the nine bounded contexts is its own package, with **dependency-boundary lint rules that encode the ADR-0002 relationships** (only Rulesets importable by all; Payments / Identity & Access reachable only behind their ACLs; etc.). Build orchestration (Nx/Turborepo) is deferred until build times justify it.
- The **PHP WordPress connector lives in its own repository**, on an independent release cycle, kept out of the TypeScript monorepo.

**3. Event backbone — modular monolith + transactional outbox; broker deferred.**

- The nine contexts run as a **modular monolith** (one deployable). Domain events are dispatched **in-process** and made durable by a **transactional outbox** written in the same database transaction as the domain change — so **no message broker is required** for the common case, including the single-container self-host.
- **NATS JetStream** is the **named, deferred forward-target**: when a context must be extracted to its own service, the outbox forwards to it. Nothing is built against it yet beyond the outbox forwarder interface. Kafka/Redpanda and RabbitMQ were considered too heavy to impose on a self-hosting club.

**4. Persistence — single PostgreSQL, schema-per-context, RLS multi-tenancy, Drizzle.**

- A **single PostgreSQL** instance. Each bounded context owns a **database schema**; there are **no cross-schema foreign keys** — contexts reference each other by ID only (ADR-0002). The **outbox table is co-located** with each context's write model so the event and the domain write commit atomically.
- Multi-tenant isolation is **row-level: `tenant_id` + PostgreSQL Row-Level Security**, applied inside each context schema. Schema-per-tenant and database-per-tenant were rejected to avoid a contexts × tenants explosion and to keep migrations single-pass. Single-tenant deployments are simply one `tenant_id`.
- Data access uses **Drizzle** (SQL-first) inside the repository adapters, behind the ADR-0001 repository ports; the **domain core stays ORM-free**. Drizzle was chosen for explicit control over the RLS session variable and the outbox-in-the-same-transaction write.

## Considered options

- **Language:** .NET/C# (strong runner-up — best DDD tooling, but forces a cross-language contract boundary for the JS widgets) and PHP/Symfony (only justified by an in-process WordPress plugin, i.e. "Shape 2 / Model B", which conflicts with ADR-0001/0002) were both rejected. See the research note for the full comparison.
- **Integration shape:** shipping the product _as_ a WordPress plugin (Model B) was rejected — it marries the framework (against ADR-0001), is inherently single-site (against ADR-0002's multi-tenancy), and reaches only WordPress (~59% of CMS sites, a minority of all sites). The thin-connector hybrid recovers most of its one-click convenience without the concessions.
- **Repo topology:** multi-repo was rejected — it kills the shared-types advantage that justified TypeScript and raises contributor onboarding cost.
- **Event backbone:** microservices-with-a-broker from day one was rejected — it forces a broker into every deployment, including volunteer-run self-hosted instances, for load a dog-show platform will not see.
- **Persistence engine:** MySQL/MariaDB (no native RLS; weaker `jsonb`) and SQLite (no RLS, single-writer, and would force a second engine for self-host) were rejected. The WordPress connector's MySQL is irrelevant because the connector talks HTTP, not SQL.
- **Data access:** Prisma was rejected for the write model (schema-first, active-record-ish, pulls against a pure core); MikroORM remains a viable alternative if unit-of-work ergonomics are later wanted.

## Consequences

- The API-first design covers any club website (WordPress, SaaS builders, hand-rolled) via widgets/iframe/oEmbed, with the WordPress connector adding one-click convenience for the largest platform.
- Choosing PostgreSQL is only possible _because_ Shape 1 decouples our persistence from the club's hosting — the club keeps its WordPress/MySQL untouched; the two databases never meet.
- The modular monolith keeps the self-host footprint to roughly "one app container + one Postgres," with a clean, pre-designed extraction path (outbox → NATS JetStream) if a context must scale out.
- Boundaries in the monorepo are enforced by tooling (lint rules), not physical walls, so that discipline must be maintained in CI.
- **Open risk:** whether any club or National Canine Organisation will _require_ self-hosting / on-prem data is unquantified (research Q4). The supported single-tenant deployment mode is the mitigation; a hard, widespread requirement could reopen the hosted-first emphasis.
