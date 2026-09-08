# Canonical directory structure

The canonical source layout for this repository — context-first, four-layer
clean architecture. Referenced by ADR-0021 and the `Architecture` section of
[`AGENTS.md`](../../AGENTS.md). The layout is language-agnostic: the trees
below omit file extensions and apply TypeScript's `kebab-case` folder
convention.

## One rule picks the layout

Count the bounded contexts — don't choose by preference:

- **Exactly one context → layer-first.** The four layers are the top of `src/`.
- **Two or more contexts → context-first.** The contexts are the top of `src/`; each contains its own four-layer stack. The root then screams the business, not the framework.

Both layouts obey the same normative rules below.

## Normative rules (mandatory — enforced where tools can)

1. **The four layer folders are named** `domain/`, `application/`, `infrastructure/`, `interfaces/` — lowercase in TypeScript. The delivery layer is `interfaces/` — plural, never singular.
2. **Dependencies point inward.**
    - `domain` imports nothing from the other layers and no external packages.
    - `application` imports `domain` only — no framework, ORM, HTTP, or database packages.
    - `interfaces` imports `application` and `domain`; never `infrastructure`.
    - `infrastructure` imports `application` and `domain`; never `interfaces`.
    - The two inner layers import **no** external packages; each outer layer imports only the external packages its edge needs (the web framework in `interfaces`, the database driver in `infrastructure`).
3. **Ports live inward, adapters outward.** A repository or other port is an _interface_ in `domain/` (or `application/ports/`); its implementation lives in `infrastructure/`.
4. **Domain objects never cross outward.** Delivery code drives a use case; it never orchestrates aggregates directly. What crosses a layer boundary is a simple data structure — a Command in, a Response DTO out — never an entity, an aggregate, or a database row.
5. **No cross-context imports.** In a context-first repo, a context imports only itself and `Shared/`. Contexts communicate at the edge — published events or an anticorruption adapter in `infrastructure/external/` — never by reaching into another context's `domain/`.
6. **Tests mirror `src/`** under a root `tests/` folder.

Rules 2 and 5 are mechanically enforced by `eslint-plugin-boundaries` on the
`src/` path patterns (ADR-0021). Rules 3 and 4 are reviewed, not mechanically
enforced.

## Conventional defaults (deviate only with a stated reason)

Inside the layers, default to this shape; collapse subfolders that would hold a single file, but never blur a layer boundary to do so.

### `domain/`

Where the model lives. Evans: "Concentrate all the code related to the domain model in one layer and isolate it from the user interface, application, and infrastructure code."

- `model/<aggregate>/` — one folder per aggregate: the root entity, `entities/`, `value-objects/`, `events/`, and the `<Aggregate>Repository` interface (implementation lives in `infrastructure/`).
    - `factories/` _(optional)_ — only when constructing the root is complex enough to swamp it (recombining a reconstituted aggregate from storage, multi-step creation). A simple constructor on the root needs no factory.
    - `specifications/` _(optional)_ — only when a business rule is combined or reused across validation and selection (e.g. querying "orders eligible for refund"). A one-off invariant belongs directly in the root, not in a specification.
- `service/` — domain services: operations meaningful in the domain that belong to no single aggregate. Stateless, named from the ubiquitous language.
- `exception/` — named invariant violations (`OrderAlreadyPaid`) — the vocabulary the root uses to refuse an illegal state change.
- `shared/` — base types every aggregate builds on (`AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`). Deliberately model-free scaffolding.

### `application/`

Orchestrates the domain to fulfil a use case; decides _when_ to act, never _whether_ an action is allowed. Martin: the use case "accepts simple request data structures for its input, and returns simple response data structures as its output" that "know nothing of the web" and must never carry Entity references.

- `<UseCase>/` — one folder per use case: `<UseCase>Command` (or Query, the request model), `<UseCase>Handler` (the interactor that coordinates the aggregate), optional `<UseCase>Response`.
- `ports/` — outbound interfaces the use cases need (`EventBus`, `Clock`, `PaymentGateway`); each has its adapter in `infrastructure/`.
- `dto/` — plain data structures shared across use cases (Commands, Queries, Responses). View models and serializers are delivery concerns and live in `interfaces/…/responses/`, not here.

### `infrastructure/`

Frameworks and drivers. Martin: "generally composed of frameworks and tools such as the database and the web framework… where all the details go… we keep these things on the outside where they can do little harm."

- `persistence/` — repository implementations, grouped by technology (`postgres/`, `inmemory/` test doubles) plus `migrations/`.
- `messaging/` — event bus / queue adapters implementing `application/ports/EventBus`.
- `external/` — adapters to third-party services and other bounded contexts (anticorruption layer), implementing the corresponding port.
- `di/` — composition root: the "Main" component that wires concrete adapters into the ports and starts the system. The one place allowed to know every layer exists.

### `interfaces/`

Delivery — how requests reach a use case and how its response is presented.

- `http/` — `controllers/` (translate an HTTP request into a Command and invoke the use case), `requests/` (input validation/binding), `responses/` (view models / presenters shaping the use case's output for display).
- `cli/` — console commands that translate arguments into a Command the same way a controller does.
- `events/` — inbound subscribers that react to a published event (this context's own, or another context's) by invoking a use case.

`apps/` — optional runnable entry points (web, cli, worker) that assemble a delivery mechanism with the composition root; sits alongside `src/`, not inside any single layer.

## Layer-first (single context)

```
src/
├── domain/
│   ├── model/
│   │   └── order/
│   │       ├── Order                     (aggregate root)
│   │       ├── entities/OrderLine
│   │       ├── value-objects/
│   │       │   ├── OrderId
│   │       │   └── Money
│   │       ├── events/OrderPlaced
│   │       ├── factories/OrderFactory      (reconstitutes Order + OrderLines from storage rows)
│   │       ├── specifications/RefundEligibleSpecification  (reused by RequestRefund and by an admin query)
│   │       └── OrderRepository           (interface — implementation in infrastructure)
│   ├── service/PricingService
│   ├── exception/OrderAlreadyPaid
│   └── shared/AggregateRoot
├── application/
│   ├── PlaceOrder/
│   │   ├── PlaceOrderCommand
│   │   ├── PlaceOrderHandler
│   │   └── PlaceOrderResponse
│   ├── dto/OrderSummary
│   └── ports/
│       ├── EventBus                      (interface — implementation in infrastructure)
│       └── PaymentGateway                (interface — implementation in infrastructure)
├── infrastructure/
│   ├── persistence/
│   │   ├── postgres/PostgresOrderRepository
│   │   └── inmemory/InMemoryOrderRepository
│   ├── messaging/RabbitMqEventBus
│   ├── external/stripe/StripePaymentGateway   (implements ports/PaymentGateway)
│   └── di/Container                      (composition root)
└── interfaces/
    ├── http/
    │   ├── controllers/OrderController
    │   ├── requests/PlaceOrderRequest
    │   └── responses/OrderView
    ├── cli/ImportOrdersCommand
    └── events/PaymentSettledSubscriber
tests/            ← mirrors src/
apps/             ← optional runnable entry points (web, cli, worker)
```

## Context-first (two or more contexts)

```
src/
├── Billing/                              ← a bounded context (screams the business)
│   ├── domain/
│   │   ├── model/invoice/
│   │   │   ├── Invoice                   (aggregate root)
│   │   │   ├── value-objects/InvoiceId
│   │   │   ├── events/InvoiceIssued
│   │   │   └── InvoiceRepository         (interface — implementation in infrastructure)
│   │   ├── service/DunningPolicy
│   │   └── exception/InvoiceNotPayable
│   ├── application/
│   │   ├── IssueInvoice/
│   │   │   ├── IssueInvoiceCommand
│   │   │   └── IssueInvoiceHandler
│   │   └── ports/OrderCatalog            (what Billing needs from Ordering)
│   ├── infrastructure/
│   │   ├── persistence/postgres/PostgresInvoiceRepository
│   │   ├── messaging/RabbitMqInvoicePublisher
│   │   └── external/ordering/OrderingAntiCorruptionAdapter   (implements ports/OrderCatalog)
│   └── interfaces/
│       ├── http/controllers/InvoiceController
│       └── events/OrderPaidSubscriber    (reacts to Ordering's published event)
├── Ordering/                             ← same four-layer shape
└── Shared/                               ← org-wide shared kernel, kept minimal
    ├── domain/AggregateRoot
    ├── application/EventBus              (interface)
    └── infrastructure/RabbitMqEventBus
tests/            ← mirrors the context/layer tree
apps/             ← optional runnable entry points (web, cli, worker)
```

`Shared/` holds only base building blocks every context reuses. A context may additionally keep a small context-local `shared/` inside its own `domain/`; keep both kernels minimal.

## Known tension: package-by-layer

Clean Architecture (ch. 34) calls both horizontal packaging (by layer) and vertical packaging (by feature) suboptimal, because in most languages folder structure alone encapsulates nothing — organization is not encapsulation. This layout accepts layer-first folders anyway and closes that gap mechanically: the `eslint-plugin-boundaries` rules are the compiler-grade boundary check the folders themselves cannot provide, and the use cases stay visible at the architectural level through `application/<UseCase>/` (ch. 21's screaming test applies to intent, which aggregate and use-case folders carry).
