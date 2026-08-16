# Core domain invariants

The rules that must always hold, per bounded context. Grounded in the FCI Regulations for Dog Shows and the SRSH/KMSH regulations (see `docs/research/` on the `research/*` branches) and the decisions in [ADR-0001](./adr/0001-kennel-club-rulesets-as-data-first-policies.md) and [ADR-0002](./adr/0002-bounded-contexts-and-event-driven-integration.md). Vocabulary is defined in [`CONTEXT.md`](../CONTEXT.md).

**Enforced vs advisory.** Some rules are _hard invariants_ the system enforces; others are _advisory_ — recorded but not machine-enforced, because the platform cannot see reliable data (e.g. a dog's full ownership or award history elsewhere). Advisory rules are marked **(advisory)**.

## Show Organisation

- A Show has exactly one **Effective Ruleset**, pinned (versioned) at setup.
- A Show belongs to exactly one **Club**; its classes and rings are defined before entries open.

## Entries & Registration

- **One Dog, one compulsory Class, per Show** — no double entry of the same Dog in the same Show.
- **An Entry becomes `Confirmed` only when its Payment succeeds.** Only `Confirmed` entries appear in the Catalogue and may be judged.
- Entries may be created or amended **only between the entry-open date and the closing date** — no late entries.
- **After close:** no Class transfer except to correct a show-committee error; a Dog may be marked **`Absent`** (scratched) on the day, but its Entry and catalogue number remain.
- **Refunds** occur only as the Effective Ruleset allows (e.g. force majeure) — not on ordinary withdrawal.
- Every Entry belongs to exactly one **Ownership**.
- Each member Dog of a **Collective Competition** must have its own `Confirmed` individual Entry at the same Show.
- **Titles are owner-asserted** — a `Title` is data the Owner records on the Dog (with evidence); the platform never computes or confirms Titles. Where a Class requires a Title (e.g. Champion class), eligibility is checked against the **owner-asserted** Title, treated as an evidence-based claim.

## Judging & Results

- A Dog may be judged only if it has a `Confirmed` Entry and appears in the **Catalogue** (barring a committee error).
- **Placement (1st–4th) only among Dogs meeting the ruleset's minimum Grade** (≥ Very Good for FCI).
- **Individual award types always carry a required minimum grade; collective award types never do.** A Grade requirement belongs only to per-sex/breed/group/show award types — collective competition awards (Best Brace, Breeders' Group, Progeny Group) are evaluated structurally by the Collective Award Policy, not by individual dog grades.
- **One CACIB per breed/sex/variety per Show**, and only to an **Excellent-1st** in an award-eligible Class. The judge's grant is **discretionary** and is **validated (not computed)** by `AwardPolicy`.
- Awards are recorded as **proposals** where the ruleset says so (FCI "subject to confirmation").
- A Judge may judge only breeds they are authorised for; the Judge is the sole authority in the ring.
- **(advisory)** Judge conflict-of-interest (owned/handled/sold the Dog within the ruleset's window; "double handling") — recorded as guidance, not hard-enforced (ownership history is often unknown to the platform).
- **(advisory)** "One CACIB per Dog per day" across concurrent Shows — cannot be reliably enforced across clubs/platforms.

## Catalogue & Publishing

- The Catalogue is generated **only after entries close** and lists **only `Confirmed` entries** in ruleset-defined order (Group → Breed → Variety → Sex → Class) with **continuous numbering**.
- **Online-publication timing obeys the Effective Ruleset** (FCI: show day only, no earlier than ~2h before opening, no personal data before then).
- Once published, **catalogue numbering is immutable**; a Dog not in the Catalogue cannot be judged (barring a committee error).
- Results are published **live** (entered ring-side) or **post-show** (entered afterwards), reflecting the recorded/validated Awards.

## Cross-cutting

- **Each Show pins a versioned Effective Ruleset**; all grade/award/eligibility evaluation uses it, and results are **immune to later ruleset edits**.
- Contexts integrate via **domain events + reference-by-ID** — no shared mutable entities; a context holds only foreign ids.
- All Class/Grade/Award vocabulary and the set of Title types come from the **Effective Ruleset** (consumers are Conformist).
