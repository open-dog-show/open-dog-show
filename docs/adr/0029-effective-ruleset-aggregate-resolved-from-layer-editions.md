---
status: accepted
---

# The Effective Ruleset is an immutable aggregate referenced by id, resolved from Ruleset Layer Editions for the show date

> Decided in #184; implemented by #190 and #191. Supersedes #144 and #149. Amends the
> "Versioning" paragraph of
> [ADR-0001](0001-kennel-club-rulesets-as-data-first-policies.md). The "pin" use case and
> Rulesets persistence land with Show Organisation (#17).

## Context

- **The docs promise a versioned pin, but the code has nothing to pin.** ADR-0001 says the
  Effective Ruleset is "snapshotted and versioned onto each Show at setup", and the
  glossary calls it "the resolved, versioned snapshot". In code, `EffectiveRuleset` had
  `resolvedAt` and `sourceLayerIds` but no identity, `EffectiveRulesetId` was declared and
  never used, `RulesetLayer` had no version, and Rulesets had no persistence.
- **Several contexts need the same rules for a Show.** Judging (grades, awards), Entries
  (class eligibility) and Catalogue (publication timing) all need them, sometimes weeks
  after setup.
- **The two docs disagree on which date applies.** ADR-0001 says a Show is judged "under
  the rules in force on its date", while the glossary said the snapshot was "stamped with
  the calendar date on which the layers were composed". Consider a Show set up in August
  for 5 October when the SRSH title rule changes on 1 October: the setup date gives the
  wrong rules.

## Decision

- **The Effective Ruleset is an immutable aggregate with an `EffectiveRulesetId`.**
  Rulesets resolves and stores it once. Show Organisation keeps only the id (ADR-0002
  reference-by-ID), and consumers read the snapshot by id through the Rulesets published
  contract. The id is the pin; there is no separate version field.
- **Resolution is the validating factory.** Every reference inside the snapshot (class →
  grade scale, class → award types, award type → minimum grade, placeable threshold ∈
  grades) is checked when it is composed, so consumers never re-check.
- **Ruleset Layers have dated Ruleset Layer Editions.** A rule change never edits an
  edition; it publishes a new edition of the same layer, effective from a stated date.
- **A Show gets the rules in force on its show date.** For each of the Ruleset's ordered
  layers, resolution takes the latest edition effective on or before the show date, and
  the snapshot records which editions were used.
- **A Show may be re-pinned only until entries open.** After that its pin never changes,
  because Entries have been judged eligible under it.

## Considered options

- **Each Show copies the resolved snapshot as a value object**: rejected. Every consuming
  context needs its own copy (carried in events or fetched from Show Organisation), so the
  same rules live in three or four places.
- **Store the recipe (layer ids + versions + date) and re-resolve on demand**: rejected.
  Every historical edition must stay installed unchanged forever, and "immune to later
  edits" then depends on catalogue discipline rather than an immutable record.
- **Pin by setup date forever**: rejected. A Show set up early would be judged under rules
  no longer in force, contradicting ADR-0001.
- **No editions; a rule change is a new layer with its own id, chosen by a person at
  setup**: rejected. The platform would push "which rules are in force" onto humans.

## Consequences

- Rulesets gains a repository and, with Show Organisation, a pin use case: its first
  persistence.
- `RulesetLayer.parentLayerId` is dropped. Layer order is the Ruleset's ordered layer list.
- Policy code must not vary by edition. Rule changes are data, per the ADR-0001 amendment
  of the same date.
