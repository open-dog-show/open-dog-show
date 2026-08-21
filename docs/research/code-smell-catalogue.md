# Code Smell Catalogue — Research Findings

## Purpose

This document catalogues code smells from five authoritative source families: Fowler's *Refactoring* (2nd ed.), Domain-Driven Design (Evans/Vernon), Clean Architecture (R. C. Martin), Clean Code chapter 17 heuristics (R. C. Martin), and modern distributed-systems literature (Newman, Young, Dahan, Fowler). It is intended as a reference for the `code-review` skill and any future `improve-codebase-architecture` skill.

---

## 1. Fowler Smells (Complete List — *Refactoring* 2nd ed., 2018)

The 2018 edition lists **24 smells** — not the same 22 as the first edition. Three names changed (`Long Method → Long Function`, `Lazy Class → Lazy Element`, `Inappropriate Intimacy → Insider Trading`) and three new smells were added (`Global Data`, `Mutable Data`, `Loops`). Two smells from the first edition were removed (`Parallel Inheritance Hierarchies` merged into `Shotgun Surgery`; `Incomplete Library Class` dropped).

### Already in the code-review skill (12)

| Smell | One-line reminder |
|---|---|
| Mysterious Name | Name doesn't reveal intent |
| Duplicated Code | Same logic shape in multiple places |
| Feature Envy | Method reaches into another object's data more than its own |
| Data Clumps | Same group of fields travels together everywhere |
| Primitive Obsession | Primitive standing in for a domain concept |
| Repeated Switches | Same switch/if-chain on the same type in multiple places |
| Shotgun Surgery | One logical change forces many scattered edits |
| Divergent Change | One file edited for several unrelated reasons |
| Speculative Generality | Abstraction added for a need that doesn't exist yet |
| Message Chains | Long `a.b().c().d()` navigation chains |
| Middle Man | Class that mostly just delegates onward |
| Refused Bequest | Subclass ignores most of what it inherits |

### Missing from the code-review skill (12 remaining)

**Long Function** — what it is: a function that has grown to the point where it's hard to understand in one reading; the longer a function is, the harder it is to understand what it does. → spot in a diff: functions longer than ~10 lines, functions with multiple levels of nesting, functions that do setup, processing, and output all in one body. → fix: *Extract Function* repeatedly until each function does one named thing.

**Long Parameter List** — what it is: more than three or four parameters; callers struggle to remember the order and meaning of arguments; tests become brittle. → spot in a diff: function signatures with 4+ params, especially when adjacent params share a type and could be swapped silently. → fix: *Introduce Parameter Object* (bundle related params into a new type) or *Preserve Whole Object* (pass the object instead of its fields).

**Global Data** — what it is: data that can be accessed and mutated from anywhere in the codebase — module-level mutable variables, singletons with write access, exported mutable constants. One of the most dangerous smells because the source of a mutation is arbitrarily far from where its effect is felt. → spot in a diff: new `export let`, mutable module-level state, static mutable fields, globally-accessible caches without clear ownership. → fix: *Encapsulate Variable* behind a function or class; inject the dependency explicitly.

**Mutable Data** — what it is: data that can be changed by any caller at any time; a broader concern than Global Data (applies even to non-global mutable state). Mutations at distance cause unexpected bugs. → spot in a diff: objects with public setters that have no invariant checks, collections returned by reference without defensive copies, state mutation inside loops or callbacks. → fix: *Change Value to Reference* carefully; prefer immutable value objects; use *Encapsulate Record*; apply *Split Phase* to separate data creation from mutation.

**Loops** — what it is: an imperative loop where a pipeline (`map`, `filter`, `reduce`) would communicate intent more clearly. A loop forces the reader to simulate execution; a pipeline names the transformation. → spot in a diff: `for` / `while` / `forEach` loops that accumulate a result, filter elements, or transform a collection one step at a time. → fix: replace with pipeline operations (`map`, `filter`, `reduce`, `flatMap`). *Replace Loop with Pipeline.*

**Lazy Element** (was *Lazy Class* in 1st ed.) — what it is: a class, function, or module that does so little it no longer justifies its existence — often a remnant of an earlier design or over-eager abstraction. → spot in a diff: a file with one trivially thin method that adds no logic beyond delegating to another class; a class with a single field and no behaviour. → fix: *Inline Function* or *Inline Class* — collapse it into its caller.

**Temporary Field** — what it is: an object field that is only populated and meaningful under certain conditions; during the rest of the object's lifetime it is empty or null, leaving readers uncertain why it exists. → spot in a diff: fields set in one method and read only in another, fields that are null for much of the lifecycle, comments explaining "this is only set when X". → fix: *Extract Class* the field and the code that uses it into a separate object that is only created when needed; or use *Replace Temp with Query*.

**Insider Trading** (was *Inappropriate Intimacy* in 1st ed.) — what it is: two classes that are too intimate — each digs into the other's private parts more than they should; they trade private data or internal implementation details. → spot in a diff: class A accessing private or internal members of class B, two classes that are always changed together, test code that reaches into internal state. → fix: *Move Method* or *Move Field* to reduce what each class needs to know about the other; *Extract Class* to create a shared intermediary; *Hide Delegate* to interpose a clean interface.

**Large Class** — what it is: a class that has accumulated too many responsibilities — too many fields, too many methods, doing too many different things. The longer a class grows, the less coherent it becomes. → spot in a diff: a class file growing beyond ~200 lines, a class with fields that are only used by a subset of its methods (sub-clumping), a class name that has to include "And" or is vague like `Manager` or `Handler`. → fix: *Extract Class* for each coherent cluster of fields and behaviour; *Extract Superclass* or *Replace Type Code with Subclasses* if appropriate.

**Alternative Classes with Different Interfaces** — what it is: two or more classes that do the same thing but have different method names or signatures, preventing polymorphic use. → spot in a diff: two new classes introduced for similar purposes, one replacing the other without the old one being removed; or two service/repository classes with near-identical behaviour under different names. → fix: *Rename Function* to harmonise the interface; then *Extract Superclass* or introduce a shared interface so they are interchangeable.

**Data Class** — what it is: a class that is nothing but fields, getters, and setters — a passive record with no behaviour. All the logic that belongs to it lives elsewhere, often in Feature-Envying callers. → spot in a diff: a new class added with only public properties and no methods beyond accessors; a class that is always modified by extracting its fields in the caller. → fix: *Move Method* to bring the behaviour that acts on these fields into the class; encapsulate mutable fields; consider making it an immutable value object.

**Comments** — what it is: a method body dense with explanatory comments where the code itself fails to communicate. Comments as a smell does *not* mean "never comment"; it means that when a comment is needed to explain what code does, the code should be refactored to make the comment unnecessary. Comments explaining *why* a non-obvious decision was made are fine. → spot in a diff: inline comments that translate each line of code into English, long block comments describing a method body's logic, TODO/FIXME comments that have lived for more than one sprint. → fix: *Extract Function* and give it a revealing name; *Rename Variable*; *Introduce Assertion* to make a precondition explicit. Leave the comment only if it explains *why*, not *what*.

---

## 2. DDD Smells

Sources: Eric Evans, *Domain-Driven Design* (2003); Vaughn Vernon, *Implementing Domain-Driven Design* (2013); Martin Fowler, bliki articles.

**Anemic Domain Model** — Evans/Fowler (2003) — domain objects are data bags: they have fields and getters/setters but no behaviour; all logic lives in procedural service classes. The domain layer is a Transaction Script in disguise. → spot: `Order`, `Customer`, etc. have only properties; a `XxxService` or `XxxManager` holds all the business logic and manipulates those objects from outside. → fix: move the invariant-enforcing behaviour back into the entity or value object; push aggregate-level rules into the aggregate root; keep services thin and coordinative.

**Overstuffed Aggregate** — Vernon — an aggregate has grown to encompass too many child entities and too many unrelated invariants; its consistency boundary is far wider than necessary, causing contention and bloated transactions. → spot: an aggregate root that loads dozens of child collections; a `save()` call that touches 10+ database rows; multiple bounded-context concepts crammed into one aggregate. → fix: identify the true invariant that must hold within a single transaction; split the aggregate so each consistency boundary covers only what must be consistent together; reference other aggregates by ID, not by direct object reference.

**Wrong Aggregate Boundary** — Vernon — aggregate boundaries are drawn along convenience lines (e.g., matching a database table) rather than along domain invariant lines; invariants that should be enforced atomically span multiple aggregates, or a single aggregate enforces rules across concepts that belong in separate bounded contexts. → spot: `TransactionScript`-style service methods that must lock multiple aggregate roots simultaneously; frequent use of domain events just to keep aggregates in sync within the same transaction. → fix: redraw boundaries by asking "what must be consistent *right now* vs. what can be eventually consistent?"; use domain events for cross-aggregate propagation.

**Leaky Bounded Context** — Evans — a context-specific concept (its internal entity types, its internal identifiers, its vocabulary) escapes the context's boundary and appears in another context's code directly, creating hidden coupling. → spot: a type from `@ods/iam` imported directly into `@ods/rulesets`; shared database tables used by two contexts; a REST response shape from one context re-used as the request type in another. → fix: introduce an ACL (Anti-Corruption Layer) or a published language at the context boundary; translate concepts explicitly when crossing contexts.

**Implicit Concepts** — Evans — a concept that the domain experts talk about and that shapes the design is never explicitly named in the code; it exists as a convention, a comment, or a pattern spread across many places, but has no first-class type. → spot: domain experts use a term ("eligibility window", "qualification period") that doesn't appear as a type in the codebase; logic for computing something is duplicated in 3 places because it has no home. → fix: name the concept, create a class or value object for it, and make it explicit.

**Ubiquitous Language Violation** — Evans — the code uses different vocabulary from the domain experts; developers have invented technical synonyms (`handler`, `processor`, `dto`) that map to domain concepts but obscure them. → spot: method names like `process()`, `handle()`, `execute()` that reveal nothing about the domain operation; field names like `data`, `payload`, `info`; a class called `OrderManager` where the domain calls the concept a "Dispatcher". → fix: rename to use the terms the domain experts use; update CONTEXT.md and any ADRs to record the language choices.

**God Application Service** — Vernon — a single application service class accumulates use-case handlers for an entire bounded context; it grows into a 1000-line file with dozens of injected dependencies. → spot: an `XxxApplicationService` class with more than ~5 public methods, or one that depends on 6+ repositories/ports. → fix: split by use-case group; one class per use-case cohort or one class per command/query (if using CQRS).

**Domain Logic in Application Layer** — Evans/Vernon — business rules, invariant checks, or domain decisions live in the application service or controller, not in domain objects. → spot: `if` statements in a use-case method that enforce business rules; validation logic in a service that should live on the aggregate; "domain events" published from the controller. → fix: move the logic into the aggregate or domain service it belongs to; application layer should be thin — coordinate, not decide.

**Transaction Script Disguised as Domain Model** — Evans — objects look like a domain model (named after domain nouns) but the actual logic follows a sequential procedural script; each "entity" is just a row in the DB, and the "service" is a stored procedure in application code. → spot: service methods that read from one repository, compute, and write to another, with the domain objects playing no active role; absence of any domain method that enforces an invariant. → fix: identify the invariants that must hold, push them into the entities, and let the application service merely orchestrate.

**Missing Value Object** — Evans — using a primitive (string, int, UUID) or a plain entity for something that is conceptually identity-less and equality-by-value; mutability is introduced where it should not be. → spot: `string` used for email, money, or measurement; entity-style objects with mutable state for concepts like `DateRange`, `Money`, `EmailAddress`. → fix: introduce an immutable value object; derive equality from its constituent values.

**Repository as Query Builder** — (community pattern, inferred from Evans/Vernon) — the repository interface leaks query specifics into the domain layer; callers pass predicates, SQL fragments, or ORM criteria objects through the port. → spot: repository methods like `findBy(criteria: Partial<Order>)`, `query(sql: string)`, or methods that accept ORM-specific filter objects. → fix: name queries by intent — `findPendingOrdersOlderThan(age: Duration)` — each query method should have a domain-legible name; push the filtering logic to the infrastructure side of the port.

**Smart UI Anti-Pattern** — Evans — domain logic embedded in the presentation or delivery layer (HTTP handlers, event listeners, CLI commands) rather than in the domain model. → spot: business rules, validations, or domain calculations inside a controller, a GraphQL resolver, or an HTTP middleware. → fix: move logic into the domain layer; the delivery mechanism should translate inputs to commands/queries and translate outputs to responses.

---

## 3. Clean Architecture Smells

Sources: Robert C. Martin, *Clean Architecture* (2017); Martin's blog posts (2011–2012); Alistair Cockburn, *Hexagonal Architecture* (2005); general Ports-and-Adapters literature.

**Layer Bypass** — Martin (*Clean Architecture*, ch. 22) — code in an outer layer skips a layer and calls directly into a deeper layer, bypassing the intended abstraction. Example: an HTTP controller calling a repository directly, skipping the use-case layer. → spot: `import` statements from a controller module into an infrastructure module; a presenter calling domain objects directly. → fix: enforce the Dependency Rule: source-code dependencies must point only inward; add the missing layer; use lint boundary rules (`eslint-plugin-import` restrictions or `@ods` package-boundary guards).

**Circular Dependency** — Martin (*Clean Architecture*, ch. 14, "The Component Dependency Principle") — two or more components depend on each other, directly or transitively, creating a cycle that prevents independent deployment and makes reasoning difficult. → spot: TypeScript `import` chains that form a loop; two packages in the monorepo that each list the other as a dependency. → fix: apply the Dependency Inversion Principle: extract a shared interface or abstract concept into a third component that both depend on (inward); or merge the cyclic components if they genuinely cannot be separated.

**Framework Obsession** — Martin (blog, 2014, "Framework Bound") — business logic is tightly coupled to framework types, decorators, or lifecycle hooks; the framework is treated as the application rather than as a tool. → spot: domain entities annotated with ORM decorators; use-case classes that extend framework base classes; business logic that can only be tested by starting the framework. → fix: keep framework types at the outermost layer; domain objects should be plain objects with no framework imports; inject framework capabilities through ports.

**ORM Leakage** — (inferred from Martin's database-independence principle) — ORM entity classes or database row types cross an architectural boundary inward; the domain layer references types generated from or shaped by the persistence schema. → spot: an ORM entity class used directly as a domain aggregate root; a repository method returning a framework-specific `Result` or `Row` type that is then passed to a use case. → fix: map ORM entities to domain objects at the infrastructure boundary; define the repository interface in the domain layer in terms of domain types.

**Fat Controller / Fat Use Case** — (Martin's delivery-mechanism principle) — a controller or HTTP handler contains business logic instead of merely translating inputs to use-case invocations and translating outputs to responses; similarly, a use-case class grows to contain domain logic that belongs in entities. → spot: a controller method longer than ~20 lines, containing `if` branches for domain decisions; a use-case with domain invariant checks rather than aggregate method calls. → fix: move domain logic into aggregates or domain services; keep controllers under 10 lines of real logic.

**Infrastructure Seeping Inward** — Martin (Dependency Rule) — infrastructure concerns (database connection details, HTTP client types, file paths, logging framework types) appear in the domain or application layer. → spot: a domain service that imports a logger, or a use-case that imports a specific HTTP library; `import` of `pg`, `knex`, or `drizzle` in a domain file. → fix: define ports (interfaces) in the domain layer for any capability the domain needs; implement those ports in the infrastructure layer.

**Screaming Architecture Violation** — Martin (blog 2011, "Screaming Architecture") — looking at the top-level directory structure, it is impossible to tell what the application *does* — the architecture "screams" framework or database technology rather than use cases. → spot: top-level directories named `controllers/`, `models/`, `views/`, `repositories/` rather than domain-oriented names; a new developer cannot identify the core business purpose from the folder structure alone. → fix: reorganise by bounded context and use-case cohort, not by technical layer; names should reveal business purpose.

**Missing Anti-Corruption Layer (ACL)** — Evans/Martin — a system integrates directly with a third-party API or legacy system without any translation layer; the external system's vocabulary and data shapes leak into the core domain. → spot: a domain object with fields named after a third-party API's response schema; direct use of an external library's types inside a use case. → fix: create an ACL that translates external concepts into the bounded context's own language; the domain only sees its own types.

**Dependency Inversion Violation** — Martin — a concrete class in an inner ring directly references a concrete class in an outer ring (or the wrong direction generally); the inner ring should define an interface and the outer ring should implement it. → spot: a use-case class that `new`s up a repository implementation directly; a domain entity that calls `new PostgresClient()`. → fix: inject the dependency through the port (interface); use a DI container or manual wiring at the composition root.

**Test Coupling to Infrastructure** — (Martin's testability principle) — unit tests for domain or application logic depend on the database, network, or file system; they are slow and brittle. → spot: test files that import real database clients, start a server, or require environment variables to run; test setup methods that insert and clean database rows. → fix: test domain logic against in-memory fakes implementing the ports; reserve infrastructure tests for integration tests only.

---

## 4. Clean Code Smells (Heuristics — non-Java)

Source: Robert C. Martin, *Clean Code* (2008), Chapter 17 "Smells and Heuristics". The chapter groups ~66 items as Comments (C), Environment (E), Functions (F), General (G), Names (N), and Tests (T). Java-specific items (J1–J8) are omitted.

### Comments

**C1 — Inappropriate Information** — comments hold metadata that belongs in a version-control system (author, date, change history) or a ticket tracker; they clutter source files and go stale instantly. → fix: delete; use `git blame` for history.

**C2 — Obsolete Comment** — a comment that described code that has since changed and now describes something untrue or misleading. → fix: delete or update when the code changes; treat a stale comment as a bug.

**C3 — Redundant Comment** — a comment that says exactly what the code says, adding no information (`// increment i` above `i++`). → fix: delete.

**C4 — Poorly Written Comment** — a comment so brief or cryptic it requires more effort to understand than the code itself. → fix: invest the effort to write it properly or — more often — delete it and rename the code.

**C5 — Commented-Out Code** — dead code left in place as a comment; it accumulates, rots, and confuses. Version control is the safety net. → fix: delete immediately.

### Environment

**E1 — Build Requires More Than One Step** — the build requires manual steps (run this script, set this env var, install this tool separately). → fix: a single command (`pnpm build`) should produce a clean build from a fresh checkout.

**E2 — Tests Require More Than One Step** — running the test suite requires setup beyond a single command. → fix: `pnpm test` runs all tests, including spinning up any needed fakes.

### Functions

**F1 — Too Many Arguments** — functions with more than two or three arguments; beyond three, every new argument multiplies the ways the function can be called incorrectly. → fix: *Introduce Parameter Object*; group related params into a record type.

**F2 — Output Arguments** — a function modifies one of its arguments (side-effecting parameter) instead of returning a new value. Readers don't expect arguments to be mutated. → fix: return the modified value; or make the mutation explicit by operating on `this`.

**F3 — Flag Arguments** — a boolean parameter that causes the function to do two different things depending on its value. → fix: split into two separate functions with names that reveal what each does.

**F4 — Dead Function** — a function that is never called anywhere. → fix: delete; version control preserves history if it's ever needed.

### General

**G2 — Obvious Behaviour Unimplemented** — a function or class doesn't implement behaviour a reasonable reader would expect (Principle of Least Surprise). → spot: `add(item)` that doesn't actually persist; a `Parser` that only handles the happy path. → fix: implement what the name promises, or rename to be honest about limitations.

**G3 — Incorrect Behaviour at Boundaries** — the code doesn't handle edge cases (zero, empty, negative, max values); bugs live at boundaries. → spot: absence of boundary-condition tests in the diff. → fix: write boundary tests; add guards.

**G4 — Overridden Safeties** — disabling warnings, removing null checks, suppressing lint rules, setting test timeouts to `0` — shortcuts that remove the safety net. → spot: `// eslint-disable`, `// @ts-ignore`, deleted guard clauses. → fix: fix the underlying issue; don't silence the warning.

**G5 — Duplication** — DRY violation; already covered by Fowler's Duplicated Code but Martin emphasises it at every level, including algorithmic duplication hidden behind different names. → fix: abstract the duplication into a single authoritative place.

**G6 — Code at Wrong Level of Abstraction** — a high-level policy function contains low-level detail (or vice versa); mixing abstraction levels makes each level harder to understand. → spot: a use-case method that contains a SQL fragment; a domain aggregate that checks an HTTP status code. → fix: *Extract Function*; move the detail to the appropriate layer.

**G7 — Base Classes Depending on Derivatives** — a base class or abstract type imports or knows about a concrete subclass. → spot: `instanceof` checks in a base class; a parent class importing a child class. → fix: invert the dependency; let the child class provide the behaviour the parent needs via a virtual method.

**G8 — Too Much Information** — a module or class exposes far more surface area than it needs to; every public item is a dependency someone can take on. → spot: dozens of public methods, exported internals, wide `index.ts` re-exports. → fix: hide everything that doesn't need to be public; expose only what callers genuinely need.

**G9 — Dead Code** — code that can never be reached (unreachable branch, deprecated function never called). → fix: delete.

**G11 — Inconsistency** — similar things are done in different ways: names, patterns, error-handling approaches, test structure. → spot: a diff that introduces a third approach to something already done two ways. → fix: pick one approach; apply it everywhere.

**G13 — Artificial Coupling** — two modules are coupled to each other for convenience, not because they genuinely depend on each other; e.g., constants defined in a domain entity that are only needed by infrastructure. → fix: move each thing to the module that owns it.

**G16 — Obscured Intent** — code that is so terse, clever, or abbreviated that its purpose is invisible on first reading. → spot: bitwise tricks where arithmetic would do; single-letter variable names in a function body; chains of operations with no intermediate named values. → fix: use *Explain with Explanatory Variable*; prefer clarity over cleverness.

**G17 — Misplaced Responsibility** — a function or class does something that rightfully belongs somewhere else; the placement is driven by convenience rather than design. → spot: formatting logic in a domain object; business rules in a repository; query construction in a controller. → fix: move the code to where it conceptually belongs.

**G22 — Make Logical Dependencies Physical** — a module assumes something about another module (order of initialisation, a flag, a side effect) without declaring that assumption as an explicit dependency. → spot: a service that only works after another service has been called; a module that reads from a variable it doesn't own. → fix: make the dependency explicit via a function parameter or type constraint.

**G25 — Replace Magic Numbers with Named Constants** — numeric or string literals embedded in logic with no explanation of their meaning. → spot: `if (status === 4)`, `timeout = 5000`. → fix: `const MAX_RETRY_COUNT = 5`; give each literal a name at the right scope.

**G28 — Encapsulate Conditionals** — a complex boolean expression used directly in an `if`; the reader must parse the logic rather than read its intention. → fix: extract to a well-named predicate function or variable: `if (isEligibleForPromotion(member))`.

**G29 — Avoid Negative Conditionals** — `if (!isNotEmpty())` is harder to read than `if (isEmpty())`. → fix: express the condition positively.

**G31 — Hidden Temporal Coupling** — two functions must be called in a specific order but nothing in the type system or function signatures enforces that order. → spot: `service.prepare()` must be called before `service.execute()`, but both are public with no guard. → fix: make the dependency explicit: chain via return type, builder pattern, or a type that carries the "prepared" state.

**G36 — Avoid Transitive Navigation (Law of Demeter)** — the same as Fowler's Message Chains; code that navigates through multiple objects to get to what it needs. → fix: add a delegation method on the first object; don't reach through the chain.

### Names

**N2 — Choose Names at the Appropriate Level of Abstraction** — implementation-revealing names at a high-level interface (`getTcpConnection()` on a `Communicator`) break the abstraction. → fix: use names from the level of abstraction the module is supposed to operate at (`connect()`).

**N5 — Use Long Names for Long Scopes** — short cryptic names (`i`, `x`, `t`) are fine for a three-line loop; they are not fine for parameters or fields that are used throughout a class. → fix: give things names proportional to the breadth of their scope.

**N7 — Names Should Describe Side Effects** — if a function mutates state or produces a side effect, its name should say so. `getConnector()` that also creates the connector if it doesn't exist is misleading. → fix: rename to `getOrCreateConnector()` or separate the creation from the retrieval.

### Tests

**T1 — Insufficient Tests** — a test suite that doesn't cover the edge cases, error paths, or key invariants of the code under test. → spot: new business logic added to a diff with no corresponding new test cases. → fix: test every non-trivial branch; test boundary conditions; test the invariants the domain model is supposed to enforce.

**T3 — Don't Skip Trivial Tests** — a test that looks trivial may be the only regression safety net for a subtle interaction. → fix: write it; the cost is one line; the benefit can be days of debugging.

**T5 — Test Boundary Conditions** — the edges of valid input ranges (zero, one, max, empty collection, last item) are where bugs concentrate. → fix: explicitly test both sides of every boundary.

**T9 — Tests Should Be Fast** — slow tests are not run; tests that are not run provide no safety. → spot: tests taking more than a few milliseconds per unit, tests with `sleep()`, tests that spin up servers. → fix: use fakes for I/O; keep unit tests in-memory; segregate slow integration tests.

---

## 5. Modern Architecture Smells

Sources: Sam Newman, *Building Microservices* (2015, 2nd ed. 2021); Martin Fowler, bliki (MonolithFirst, CQRS, DistributedMonolith); Greg Young, CQRS/ES talks (2010–2014); Udi Dahan, clarified CQRS (2009); general distributed-systems literature.

**Distributed Monolith** — Fowler/Newman — services that appear independent at the deployment level but are so tightly coupled at runtime (synchronous chained calls, shared database, shared schema) that they cannot be deployed or scaled independently; you get all the costs of microservices with none of the benefits. → spot: a "microservice" that cannot start without another service being healthy; services that share a database schema owned by none of them; a service that calls 5 others synchronously for every incoming request. → fix: enforce proper service boundaries with independently deployable contracts; use asynchronous messaging for non-critical coupling; give each service exclusive ownership of its data store.

**Shared Database / Integration Database** — Newman — multiple services share a single physical database, coupling their schemas, deployment cycles, and team ownership. Schema changes require coordinating all consumers. → spot: two or more services listed in connection string config pointing to the same database; a migration file that adds a column used by services in different bounded contexts. → fix: give each service its own schema or database; communicate between services via published events or well-versioned APIs.

**Chatty Services** — Newman — a single business operation requires many sequential round-trips between services; latency compounds and failure modes multiply. → spot: a request trace showing service A calling B, B calling C, C calling D in sequence for what should be a single user-visible operation; an integration test that stubs 5 external services for a single action. → fix: redesign the interaction to be coarser-grained; prefer asynchronous collaboration; use the BFF (Backend For Frontend) pattern to aggregate data at the edge.

**Nano-services (Over-splitting)** — Newman/Fowler — services are decomposed to a granularity finer than the team or domain can sustain; each service is so trivial that it adds deployment, monitoring, and communication overhead with no autonomy benefit. → spot: a "service" with fewer than 5 use cases; a service that is always deployed together with another service; a service that only exists to wrap one database table. → fix: merge; start coarser and split only when you have a clear independence-of-change or team-ownership reason.

**Event Soup** — Greg Young / community — an event-driven system where events proliferate without schema governance, versioning strategy, or semantic consistency; consuming services must handle dozens of subtly different event shapes; the event stream becomes incomprehensible. → spot: events named generically (`DataUpdated`, `ThingChanged`, `SomethingHappened`); events with `payload: any`; no schema registry or versioning scheme; consumers that react to every event type regardless of their bounded context. → fix: use a schema registry; name events after the business fact they record (`OrderPlaced`, `PaymentAuthorised`); version event schemas explicitly; define which context owns which events.

**Promiscuous Event Sourcing** — Young — applying Event Sourcing to aggregates or contexts that don't benefit from it; every change generates a stream of low-level events that are used as a persistence mechanism but carry no business meaning and make the read side needlessly complex. → spot: events like `FieldUpdated`, `RowInserted`; events whose names mean nothing to a domain expert; Event Sourcing adopted as a technology trend rather than for auditability or temporal queries. → fix: use Event Sourcing only where you need the full audit trail or where past state must be reconstructable; for simple CRUD, use a conventional database.

**Premature / Overuse of CQRS** — Fowler (CQRS bliki, 2011) — CQRS applied uniformly across a system when most of the system is simple CRUD; the additional complexity of separate read and write models, eventual consistency, and event propagation outweighs any benefit. → spot: CQRS introduced for a context where the query model is the same as the write model; a team spending more effort on CQRS infrastructure than on business logic. → fix: apply CQRS only within bounded contexts where the command and query models genuinely diverge (high read/write disparity, complex projection requirements); leave simple contexts as CRUD.

**Saga Sprawl** — (distributed-systems community, post-Newman) — replacing a simple database transaction with a multi-step saga that spans services, introducing compensating transactions, timeout logic, and retry policies for what was previously a local atomic operation; the saga becomes too complex to reason about or test. → spot: a saga with more than 5 steps; a saga that must be re-read with a sequence diagram to understand; compensating actions that are untested. → fix: question whether the operation genuinely requires cross-service coordination; where possible, redesign so a single aggregate owns the invariant; apply the saga pattern only when cross-service consistency is unavoidable and the team can sustain the operational complexity.

**API Gateway Overload** — Newman — the API gateway accumulates business logic (routing decisions based on domain rules, data transformation, aggregation) that belongs in services or in dedicated BFF layers; it becomes a shared bottleneck and a single point of change. → spot: an API gateway config or code file that branches on request content to apply domain rules; gateway code that joins data from multiple services. → fix: keep the gateway focused on cross-cutting concerns (auth, rate limiting, TLS termination, routing); move aggregation to a BFF service owned by a specific consumer team.

**Missing Anti-Corruption Layer at Service Boundary** — Evans/Newman — a service consumes a third-party or legacy API and uses the external service's data shapes and vocabulary directly in its own domain model; the external model pollutes the internal one. → spot: internal domain types with field names matching an external API's JSON keys; direct use of a vendor SDK's types in domain or application code. → fix: create an ACL adaptor in the infrastructure layer; translate at the boundary; the domain sees only its own language.

---

## 6. Recommendations for Skill Integration

### Additions to the code-review skill — Standards baseline

The following 12 Fowler smells should be added to close the gap between what the skill covers and the complete 2nd-edition catalogue:

| Smell | Priority | Rationale |
|---|---|---|
| Long Function | High | Universally applicable; easy to spot in a diff |
| Long Parameter List | High | Frequently introduced with new use cases |
| Global Data | High | Security-relevant (shared mutable state); easy to spot |
| Mutable Data | High | Causes concurrency bugs and unexpected test interactions |
| Large Class | Medium | Spot in growing service/aggregate classes |
| Temporary Field | Medium | Signals unclear lifecycle; common in ported procedural code |
| Insider Trading | Medium | Distinct from Feature Envy; targets structural coupling |
| Data Class | Medium | Related to Anemic Domain Model; common in TypeScript DTOs |
| Lazy Element | Low | Useful but requires judgement about intentional thin adapters |
| Alternative Classes with Different Interfaces | Low | Requires two similar classes to be visible simultaneously |
| Loops | Low | Language-style preference; low signal-to-noise in TypeScript |
| Comments | Low | Already implied by existing standards; add as explicit check |

The following **DDD smells** are directly applicable to this codebase's architecture (modular monolith, DDD, strict context boundaries per `CONTEXT.md`) and should be added to the Standards baseline or a new DDD-specific section:

| Smell | Priority | Rationale |
|---|---|---|
| Anemic Domain Model | High | The most common DDD failure mode |
| Leaky Bounded Context | High | Directly enforced by the `@ods/<name>` package boundary structure |
| Domain Logic in Application Layer | High | Easily spotted in application service diffs |
| Ubiquitous Language Violation | Medium | Check against `CONTEXT.md` terminology |
| Missing Value Object | Medium | Common when primitive types are used for domain concepts |

The following **Clean Code heuristics** should be added as named judgement calls (they are generally already implied by existing standards but naming them makes the review more precise):

| Smell | Priority | Rationale |
|---|---|---|
| G25 — Magic Numbers | High | Easily spotted; universally applicable |
| G28 — Encapsulate Conditionals | Medium | Improves readability of domain rules |
| G31 — Hidden Temporal Coupling | Medium | Common in service initialisation patterns |
| F3 — Flag Arguments | Medium | Common source of confusing API surfaces |
| T1 — Insufficient Tests | High | Core quality gate for any diff |
| T5 — Test Boundary Conditions | Medium | Targets the most common location of bugs |
| T9 — Tests Should Be Fast | Medium | Prevents test-suite rot |

### Additions to the improve-codebase-architecture skill

The following smells are better suited to an architectural-review pass rather than a per-diff code review (they require looking at the whole codebase, not just a diff):

| Smell | Category | Rationale |
|---|---|---|
| Layer Bypass | Clean Architecture | Requires import-graph analysis across the whole codebase |
| Circular Dependency | Clean Architecture | Requires transitive dependency tracing |
| Framework Obsession | Clean Architecture | Visible in architectural patterns, not individual diffs |
| ORM Leakage | Clean Architecture | Requires seeing the full domain/infrastructure boundary |
| Screaming Architecture Violation | Clean Architecture | Requires a global directory-structure view |
| Missing ACL | Clean Architecture / DDD | Requires seeing integration boundaries holistically |
| Dependency Inversion Violation | Clean Architecture | Systematic pattern across composition root and wiring |
| Overstuffed Aggregate | DDD | Requires domain understanding beyond a diff |
| Wrong Aggregate Boundary | DDD | Requires domain understanding beyond a diff |
| Repository as Query Builder | DDD | Requires seeing all query methods in context |
| Distributed Monolith | Modern | Only observable at the integration/system level |
| Shared Database | Modern | Requires seeing deployment and schema configuration |
| Chatty Services | Modern | Requires seeing the full call graph |
| Event Soup | Modern | Requires seeing the full event catalogue |
| Saga Sprawl | Modern | Requires seeing multi-service interaction flows |
| Overuse of CQRS | Modern | Requires seeing the full command/query split across contexts |

### Smells to exclude from both skills

| Smell | Reason to exclude |
|---|---|
| Loops (Fowler) | Stylistic in TypeScript; pipeline preference already enforced by linting or team convention |
| C1–C5 Comments | Redundant comments caught by ESLint `no-warning-comments` or equivalent; keep only as a reminder |
| Java-specific heuristics (J1–J8) | Not applicable to TypeScript |
| Promiscuous Event Sourcing | Too advanced and context-specific for a general-purpose baseline |
| Nano-services | Not applicable to a monorepo modular monolith with no actual microservices |
| Parallel Inheritance Hierarchies (Fowler 1st ed.) | Removed in 2nd edition; folded into Shotgun Surgery |
| Incomplete Library Class (Fowler 1st ed.) | Removed in 2nd edition |
| API Gateway Overload | Not applicable until the project adopts a gateway pattern |

---

## Sources

1. Martin Fowler, *Refactoring: Improving the Design of Existing Code*, 2nd ed. (Addison-Wesley, 2018) — Chapter 3 "Bad Smells in Code". The definitive 24-smell catalogue.
2. Refactoring.Guru, "Code Smells" — <https://refactoring.guru/refactoring/smells> — community catalogue cross-referencing Fowler 1st/2nd ed. with visual summaries.
3. Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003). Primary source for Bounded Context, Aggregate, Value Object, Ubiquitous Language, Repository, Anti-Corruption Layer, Implicit Concepts, and Smart UI Anti-pattern.
4. Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley, 2013). Primary source for Overstuffed Aggregate, Wrong Aggregate Boundary, God Application Service.
5. Martin Fowler, "Anemic Domain Model" bliki (2003) — <https://martinfowler.com/bliki/AnemicDomainModel.html>
6. Martin Fowler, "Bounded Context" bliki (2014) — <https://martinfowler.com/bliki/BoundedContext.html>
7. Martin Fowler, "CQRS" bliki (2011) — <https://martinfowler.com/bliki/CQRS.html> — Fowler's warning against overuse; quotes Greg Young and Udi Dahan.
8. Robert C. Martin, *Clean Code: A Handbook of Agile Software Craftsmanship* (Prentice Hall, 2008) — Chapter 17 "Smells and Heuristics". ~66 heuristics in 7 categories.
9. Robert C. Martin, "The Clean Architecture" blog post (2012) — <https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html>
10. Robert C. Martin, "Framework Bound" blog post (2014) — <https://blog.cleancoder.com/uncle-bob/2014/05/11/FrameworkBound.html>
11. Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (Prentice Hall, 2017).
12. Sam Newman, *Building Microservices*, 2nd ed. (O'Reilly, 2021). Primary source for Distributed Monolith, Shared Database, Chatty Services, Nano-services, API Gateway Overload.
13. Martin Fowler, "Monolith First" bliki (2015) — <https://martinfowler.com/bliki/MonolithFirst.html> — context on service-splitting risks.
14. Greg Young, "CQRS, Task Based UIs, Event Sourcing agh!" (2010) — primary source on Event Sourcing smells and CQRS scope.
15. Udi Dahan, "Clarified CQRS" (2009) — <http://www.udidahan.com/2009/12/09/clarified-cqrs/> — on when CQRS adds complexity without benefit.
16. Alistair Cockburn, "Hexagonal Architecture / Ports and Adapters" (2005) — foundational for Layer Bypass and Missing ACL smells.
17. Joshua Kerievsky, "Smells to Refactorings Cheatsheet" (Industrial Logic, 2005) — <https://www.industriallogic.com/blog/smells-to-refactorings-cheatsheet/> — cross-reference of smells to *Refactoring* page numbers.
18. Wojteklu, "Summary of Clean Code" (GitHub Gist, community summary) — <https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29> — independent verification of chapter 17 heuristic groupings.
