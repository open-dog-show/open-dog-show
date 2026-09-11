---
status: accepted
---

# Cross-context imports only through `index.ts`, along the context map's arrows

> Decided in #184; implemented by #187 (lint), #188 (generated barrels) and #189 (IAM
> contract). Amends [ADR-0002](0002-bounded-contexts-and-event-driven-integration.md) and
> [ADR-0006](0006-monorepo-scaffolding-and-shared-kernel.md) ("no cross-context imports").
> Refines [ADR-0011](0011-context-specific-identity-ports-for-iam-acl.md).

## Context

The `eslint-plugin-boundaries` config allowed a context to import only its own layers
and the Shared kernel. No context could import any file of another context, including its
`index.ts`. Two documented relationships were therefore unreachable:

- **Rulesets is a Published Language** that every context conforms to (ADR-0001/0002), so
  consumers must compile against its types and policy ports.
- **Identity & Access feeds downstream ACL adapters** that translate a User and their Role
  Grants into a context-specific identity type (ADR-0011).

At the same time, every barrel exported everything: aggregates, repository ports, Drizzle
and Postgres adapters, and test fakes. Nobody consumed them, but the first cross-context
consumer would have coupled to all of it.

## Decision

- **Rulesets:** any layer of any context may import `src/rulesets/index.ts`.
- **IAM:** only a context's `infrastructure/` (its ACL adapters, `infrastructure/external/`)
  may import `src/iam/index.ts`. Domain and application layers never see IAM.
- **Every other pair:** no imports. Contexts integrate through outbox events and foreign
  ids only (ADR-0002).
- **Deep imports** into another context remain forbidden.
- **Barrels are published contracts.** A context's `index.ts` exports only what another
  context or the composition root may use:
    - command and response types, and handler types;
    - expected-outcome errors;
    - event classes, their type constants and payload types;
    - one `create<Ctx>Context` wiring factory (implemented in `infrastructure/di/`).

    Aggregates, repositories, ports, ORM adapters and fakes stay internal; tests import them
    by deep path. `tests/` and `apps/` are not contexts, so this rule does not govern their
    imports.

- **IAM's contract** is `IdentityQuery.findIdentity(userId)` returning an `IdentitySnapshot`
  of primitives (`userId`, `active`, `roleGrants: { role, clubId }[]`), plus
  `AuthenticateHandler` and its command/response.

## Considered options

- **Any layer may import any context's `index.ts`, relying on narrow barrels**: rejected.
  Nothing stops a domain layer importing IAM (against ADR-0011) or an import against the
  context map's direction.
- **No in-process cross-context imports; downstream contexts replicate IAM data from
  events**: rejected. Role revocation would take effect with a delay (a security-relevant
  window), and Rulesets consumers must compile against its types.

## Consequences

- The boundary rules name the two allowed edges explicitly, and new allowed edges require
  amending this ADR.
- The `apps/` composition root wires contexts through `create<Ctx>Context` factories only.
- The published surface of each context is small enough to review as an API.
