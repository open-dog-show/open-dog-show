# Context Map

The domain of the open-source conformation dog-show platform, split into bounded contexts. Per-context terms live (for now) as sections in [`CONTEXT.md`](./CONTEXT.md); they will move to `src/<context>/CONTEXT.md` when code lands. Architectural rationale is in [ADR-0002](./docs/adr/0002-bounded-contexts-and-event-driven-integration.md); the ruleset mechanism is in [ADR-0001](./docs/adr/0001-kennel-club-rulesets-as-data-first-policies.md).

## Contexts

| Context | Class | Responsibility |
| --- | --- | --- |
| **Rulesets** | Core | Owns the rule vocabulary and the `Effective Ruleset` (data + the three policy ports from ADR-0001 + catalogue-publication rules). The upstream Published Language. |
| **Entries & Registration** | Core | Dog identity, exhibitor-side people, and the online-entry loop (entry, open/close, extras). |
| **Judging & Results** | Core | Per-Show ring outcomes: grades, placements, awards. |
| **Show Organisation** | Supporting | Club + Show Secretary set up Shows, classes, and rings. Upstream to Entries, Judging, and Catalogue. |
| **Catalogue & Publishing** | Supporting | Catalogue (produced after entries close, published under ruleset timing rules) and results publication (live or post-show). |
| **Titles** | Supporting | Accumulates Award facts across many Shows; evaluates and confirms Titles (NCO / FCI authority). |
| **Payments** | Generic | Entry-fee collection. Behind an anticorruption layer to an external payment provider. |
| **Identity & Access** | Generic | User accounts, login, permissions. Behind an anticorruption layer to an external identity provider. |
| **Membership** | *(Fog)* | Parked add-on; not required to enter. No model yet. |

## Relationships

Integration is via **domain events + reference-by-ID** — contexts never share mutable entities; they emit facts and reference each other by id (see ADR-0002).

- **Rulesets → (all)**: **Published Language / Conformist.** Rulesets publishes the `Effective Ruleset` shapes and policy-port interfaces; every consumer conforms. It never depends on any consumer.
- **Show Organisation → Entries & Registration**: upstream/downstream. A Show (with its resolved `Effective Ruleset`, classes, rings) must exist before entries open. Emits `ShowOpened`, `EntriesClosed`.
- **Entries & Registration → Payments**: `Entry` requests fee collection; Payments (ACL to provider) emits `EntryPaid` / `PaymentFailed`.
- **Entries & Registration → Judging & Results**: closed entries become the judging schedule. Emits `EntriesClosed`; Judging consumes it.
- **Judging & Results → Catalogue & Publishing**: ring results drive results publication. Emits `ClassJudged`, `AwardGranted`; Catalogue publishes live or post-show.
- **Entries & Registration → Catalogue & Publishing**: closed entries drive catalogue generation (ruleset-timed publication).
- **Judging & Results → Titles**: Titles consumes `AwardGranted` across Shows to evaluate Titles; emits `TitleConfirmed`.
- **Identity & Access → (Show Organisation, Entries, Judging)**: **ACL.** Provides authenticated `User`s and permissions; domain roles (Show Secretary, Exhibitor, Judge, admins) map onto Users.

```mermaid
flowchart TD
  RS[Rulesets<br/>core / published language]
  IAM[Identity & Access<br/>generic / ACL]
  SO[Show Organisation<br/>supporting]
  EN[Entries & Registration<br/>core]
  JR[Judging & Results<br/>core]
  TI[Titles<br/>supporting]
  CP[Catalogue & Publishing<br/>supporting]
  PAY[Payments<br/>generic / ACL]

  RS --> SO
  RS --> EN
  RS --> JR
  RS --> CP
  RS --> TI
  IAM --> SO
  IAM --> EN
  IAM --> JR
  SO --> EN
  SO --> JR
  SO --> CP
  EN --> PAY
  EN --> JR
  EN --> CP
  JR --> CP
  JR --> TI
```
