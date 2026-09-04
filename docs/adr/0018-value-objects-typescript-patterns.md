---
status: accepted
---

# Value objects — TypeScript patterns and rules

The codebase models domain concepts as value objects (Evans/Fowler): immutable,
equal by value, self-validating, created via a factory, side-effect-free, and
living framework-free in the domain layer. TypeScript makes several of these
rules hard to enforce — `readonly`/`private` are compile-time only, classes are
structurally typed, and `===`/`Set`/`Map` use reference identity — so this ADR
records the sanctioned patterns, chosen by whether the value space has
invariants. A PR review on `LocalDate` (#165) caught the consequence of having
no standard: a TS-private mutable `Date` field reachable for mutation.

## Context

DDD value objects (Evans, _Domain-Driven Design_; Fowler, "Value Object") are
equal by the value of their properties, not by identity; immutable; self-
validating; created via a factory; and side-effect-free. In TypeScript:

- `readonly` and the `private` keyword are **compile-time only** — erased at
  runtime. A stored `Date` can be mutated via `setUTCDate`; a TS `private` field
  is reachable via bracket access or a cast.
- Classes are **structurally typed** — a bare `{ year, month: 13, day: 99 }`
  literal is assignable to a class with only public members, bypassing any
  factory validation. Only a private member makes a class nominal.
- `===`, `Set`/`Map` keys, and `Array.includes` use **reference identity** —
  value equality must be provided by the VO and remembered by callers; the
  language will not catch a stray `===` or a `Set<LocalDate>` that silently uses
  reference identity.

The one mechanism that gives real runtime encapsulation is the ECMAScript `#`
private field (enforced by JavaScript itself; not enumerable, proxiable, or
reachable outside the class). Storing an immutable primitive sidesteps the
mutable-object problem entirely.

## Decision

Two primary patterns, chosen by whether the value space has invariants to
enforce, plus a third for fixed enumerations.

### Pattern A — Validating class value object

For concepts with a **constrained value space or intrinsic behavior**
(e.g. `LocalDate`: calendar validity; ordering; completed-months arithmetic).

- A `class` with **`readonly #` private fields** — ECMAScript `#` gives runtime
  encapsulation and makes the class nominal (nominalness is a side-effect of any
  private member, including TS `private`; `#` is chosen for the runtime
  encapsulation). Store **immutable primitives** (`number`/`string`) where
  possible — prefer a single primitive (e.g. a UTC timestamp) with accessors
  derived from it; a mutable object (e.g. `Date`) may be cached only behind `#`
  and only when derivation is costly.
- A **private constructor** + a **static validating factory** (named `of`, or
  `create` in some VOs) as the only construction path — impossible to
  instantiate an invalid VO through the public API.
- **Read-only accessors; no setters.**
- **Value equality** via `equals(other)`. Callers **must** use it — never `===`,
  and never as a `Set`/`Map` key without a derived primitive key. "Changes"
  return **new instances** via `with*`/`add*`-style methods (e.g. `withYear(n)`,
  `addMonths(n)` — illustrative; `LocalDate` has none yet); never mutate.
- **Domain layer, framework-free.**

Reference: `packages/contexts/rulesets/src/domain/local-date.ts`.

### Pattern B — Branded opaque type

For **IDs and units** whose only invariant is their identity/unit (e.g.
`ShowId`, `DogId`, `ClassId`, `AgeMonths`, `EntryRef`, `UserId`).

- `type X = Brand<T, 'X'>` — a compile-time brand gives nominalness; value
  equality and immutability come free from the primitive `T`. **`Brand` is
  declared per-context** (`@ods/kernel`, `@ods/rulesets`, `@ods/iam` each
  declare their own, with their own `unique symbol` key; only `@ods/rulesets`
  exports it, for its sibling `age-months.ts`/`entry-ref.ts`). The duplication
  is deliberate: the per-context symbol keeps same-named brands structurally
  distinct across contexts (a rulesets `ClassId` could never satisfy an
  iam-shaped brand even if the label matched), consistent with the
  no-cross-context-import rule (ADR-0004). Accept the duplication; do **not**
  hoist a shared `Brand` into the kernel.
- An `asX` cast as the boundary-crossing point (repository/controller → typed
  ID). **No validation** for opaque IDs — they are generated/assigned at the
  boundary, not user-typed; the brand's purpose is preventing substitution, not
  range-checking (a deliberate choice already documented in `@ods/kernel` and
  `@ods/iam`: "Plain cast — no validation").
- When the value space _is_ constrained (a format/range), the cast becomes a
  **validating factory** that throws on bad input — e.g. `asEventType`
  (`<context>.<PascalName>`). Use this for any branded type with a format
  invariant.

Reference: each context's `domain/domain-ids.ts` declares `Brand` and the `asX`
casts — `@ods/kernel` (`asShowId`, …, `asEventType`), `@ods/rulesets`
(`domain-ids.ts`, `age-months.ts`, `entry-ref.ts`), `@ods/iam` (`domain-ids.ts`).

### Pattern C — Closed-set vocabulary

For a fixed enumeration of string constants **that needs a runtime object** (to
iterate, validate against, or drive a UI) — e.g. `CertificateKind`.

- `export const X = { … } as const;` + `export type X = (typeof X)[keyof typeof X];`.
  `as const` gives readonly + literal types; the union type is the closed set.
  Value equality is string equality; runtime `Object.freeze` is optional
  hardening.

When **no runtime object is needed**, a bare string-literal union
(`export type X = 'A' | 'B'`) is a compliant lighter alternative — value
equality and immutability come from the primitive, and there is no runtime value
to iterate. It is out of Pattern C's scope precisely because there is no
`as const` object.

Reference: `@ods/rulesets` `domain/certificate-kind.ts` (Pattern C);
`@ods/iam` `domain/user.ts` `UserStatus` (bare union).

## Audit (existing value objects)

| VO                                                                                                                                                     | Context  | Pattern            | Compliant |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------ | --------- |
| `LocalDate`                                                                                                                                            | rulesets | A                  | ✅        |
| `EventType`                                                                                                                                            | kernel   | B (validating)     | ✅        |
| `ShowId`/`DogId`/`ClubId`/`PrincipalId`/`EventId`/`AggregateId`                                                                                        | kernel   | B (opaque)         | ✅        |
| `ClassId`/`AwardTypeId`/`GradeId`/`SpecialOutcomeId`/`GradeScaleId`/`BreedId`/`VarietyId`/`GroupId`/`ShowTypeId`/`RulesetLayerId`/`EffectiveRulesetId` | rulesets | B (opaque)         | ✅        |
| `AgeMonths`                                                                                                                                            | rulesets | B (opaque, number) | ✅        |
| `EntryRef`                                                                                                                                             | rulesets | B (opaque)         | ✅        |
| `UserId`                                                                                                                                               | iam      | B (opaque)         | ✅        |
| `CertificateKind`                                                                                                                                      | rulesets | C                  | ✅        |

**No defects found.** The existing VOs already follow the sanctioned patterns
(often by conscious convention — e.g. the kernel/iam "plain cast — no
validation" docstrings). Two notes: `AgeMonths` intentionally has **no range
invariant** — `completedMonthsSince` may return a negative (used as a
negative-age guard), so a plain `asAgeMonths` cast is correct, not a validating
factory; and `UserStatus` (iam) is a bare string-literal union, compliant and
out of Pattern C scope (no runtime object needed). This ADR formalises the
patterns; no follow-up issues are required for existing code.

## Consequences

- Consistent, defensible value objects across contexts; new VOs have a named
  pattern to follow.
- Runtime immutability/encapsulation for Pattern A via `#`; compile-time
  nominalness for Pattern B via the brand.
- **`equals()` discipline is manual** for Pattern A — the language will not
  catch `===`, `Set<LocalDate>`, or `Map` keyed by a class VO. AGENTS.md states
  the convention: compare via `equals`, or key collections by a derived
  primitive.
- **`toEqual`/`toStrictEqual` give false positives on Pattern-A instances** —
  `#` fields are non-enumerable, so every instance looks like `{}` to Vitest;
  `expect(LocalDate.of(2026, 1, 1)).toEqual(LocalDate.of(1999, 12, 31))` passes.
  Tests must compare via `expect(a.equals(b)).toBe(true)`, never
  `toEqual`/`toStrictEqual` on a Pattern-A instance. (Serialization must use the
  accessors / an `toISOString`-style method, not `Object.keys`/spread.)
- Pattern A carries a small per-instance allocation cost — acceptable for
  domain types that are not hot-path-allocated.

## Alternatives considered

- **TS `private`/`readonly` only** (no `#`): rejected — compile-time only; a
  stored `Date` is reachable for mutation and the class is structurally open
  (the #165 review finding).
- **`Object.freeze` on a plain object** for Pattern A: rejected for VOs with
  behavior — Fowler prefers a class with declared accessors; `freeze` is
  optional hardening, not the primary mechanism.
- **A branded type for everything** (no class VOs): rejected for concepts with
  invariants — a brand cannot enforce calendar validity or carry behavior.
- **Storing a mutable `Date`** in Pattern A: rejected — only an immutable
  primitive (`#ms`) or a `#`-private cached `Date` is allowed.
- **Hoist a shared `Brand` into `@ods/kernel` and export it**: rejected — it
  would make same-named brands across contexts structurally interchangeable,
  losing the cross-context nominal distinctness the per-context `unique symbol`
  provides. Per-context duplication is the deliberate choice (see Pattern B).

## Sources

- Martin Fowler, "Value Object" — https://martinfowler.com/bliki/ValueObject.html
- TypeScript Handbook, "Classes" — https://www.typescriptlang.org/docs/handbook/2/classes.html
- MDN, "Private class fields" — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields
- Evans, _Domain-Driven Design_ (VO vs entity) — referenced via Fowler.
