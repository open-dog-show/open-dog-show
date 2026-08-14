---
status: accepted
---

# Ruleset domain types carry no display names — all names are i18n

Named Ruleset concepts carry only an `id`; **`name: string` is removed** from all
domain types. Every display name — grade labels, class names, award names, and
UI strings alike — lives in a standard i18n translation bundle. The domain owns
identity (IDs) and rules; the presentation layer owns all display.

## Context

The FCI publishes its regulations in four working languages (English, French,
German, Spanish); national member organisations add their own (KMSH/SRSH adds
Dutch). An early implementation used `name: string` as a single string, then
proposed replacing it with `name: Record<LanguageCode, string>` (a Multilingual
Label, earlier draft of this ADR).

That approach was rejected after recognising a structural gap: the FCI base
layer's grades have no Dutch names, and the KMSH national layer cannot add Dutch
to FCI grades without overriding the entire grade scale — coupling a
language-addition to the rule-override mechanism. The result would be a dual
display system: domain `MultilingualLabel` for ruleset terms, plus a standard
i18n bundle for all other UI strings. Two lookup mechanisms for the same problem.

## Decision

Remove `name: string` (and its planned `Record<LanguageCode, string>` successor)
from every named Ruleset domain type (`Grade`, `GradeScale`, `SpecialOutcome`,
`ClassDefinition`, `AwardType`, `ShowType`, `RulesetLayer`). All display names
live in translation bundles keyed by a convention derived from the domain ID:

```
en.json: { "grade.excellent": "Excellent", "nav.home": "Home", ... }
nl.json: { "grade.excellent": "Uitmuntend", "nav.home": "Home", ... }
fr.json: { "grade.excellent": "Excellent",  "nav.home": "Accueil", ... }
```

The UI resolves `t('grade.' + grade.id)` for any locale. Adding a language
requires only a new translation file — no domain code changes.

## Considered options

1. **Single `name: string`** — current state. Developer-readable but carries no
   production weight. Removed in issue #64.

2. **`name: Record<LanguageCode, string>` (Multilingual Label)** — earlier
   draft. Rejected: FCI grades have no Dutch entries; KMSH cannot add Dutch
   without overriding the entire scale (coupling language to rule-change);
   creates a dual lookup system alongside a standard i18n bundle.

3. **Abstract IDs + i18n bundle** — chosen. One consistent mechanism for all
   display strings. Domain is name-free: owns identity and rules only.
   Adding a language is a frontend-only change.

## Consequences

- `name: string` is removed from all domain interfaces in `@ods/rulesets`
  (issue #64).
- `fci-ruleset-layer.ts` and `kmsh-ruleset-layer.ts` lose their `name` fields;
  the in-memory data becomes purely structural.
- The presentation layer owns all display strings via a standard i18n tool
  (`react-i18next`, `next-intl`, or equivalent).
- Translation key convention: `<concept-type>.<domain-id>` — e.g.
  `grade.excellent`, `class.junior`, `award.cacib`.

## Context

The FCI publishes its regulations simultaneously in four working languages
(English, French, German, Spanish). National member organisations add their
own: KMSH/SRSH adds Dutch and French for the Belgian layer. A Belgian show
catalogue must carry Dutch and French names for every grade, class, and award.

An early implementation assigned `name: string` to every named concept and
tried to inject Dutch names by having the KMSH national layer _override_ the
FCI grade scales — not because the rules changed, but solely to replace
`'Excellent'` with `'Uitmuntend / Excellent'`. This abused the
`resolveEffectiveRuleset` merge-by-id mechanism as a language-injection channel
and produced a composed ruleset that silently erased the FCI English names.

## Decision

Replace `name: string` on every named Ruleset concept (`Grade`, `GradeScale`,
`SpecialOutcome`, `ClassDefinition`, `AwardType`, `ShowType`) with
`name: Record<LanguageCode, string>` (a **Multilingual Label**). Each Ruleset
Layer defines labels only for the languages of its own jurisdiction:

- FCI base layer → `{ en, fr, de, es }` (FCI working languages)
- KMSH national layer → `{ nl, fr }` for its own additions (CAC, RCAC,
  Fokkersklas, etc.)

No layer needs to override another layer's concepts merely to supply an
additional language.

## Considered options

1. **Single string `name: string`, localization outside the domain** — defers
   the problem to a translation file / i18n layer. Rejected: the official names
   are published by the kennel clubs as part of the regulations themselves, not
   derived by translation. All names are co-primary; treating one as canonical
   misrepresents the domain.

2. **Layer overrides for language injection** — the path taken before this ADR.
   Rejected: pollutes the rule-override mechanism with a language concern,
   causes later layers to silently erase earlier names, and forces a national
   layer to re-specify an entire grade scale just to add one language.

3. **`name: Record<LanguageCode, string>` (Multilingual Label)** — chosen.
   Language is a first-class property of every named domain concept. Each layer
   contributes the languages of its own jurisdiction; no layer needs to override
   another's concepts for language reasons alone.

## Consequences

- `name: string` is replaced across all domain interfaces in `@ods/rulesets`.
- All in-memory data (FCI and KMSH layer implementations) must supply full
  Multilingual Labels in their respective working languages.
- Consumer code (Catalogue, Judging report) selects a language at display time
  using a Language Code; the domain holds all official names.
- The `resolveEffectiveRuleset` merge-by-id can remain wholesale-replacement;
  it no longer needs to handle language merging because no layer overrides
  another layer's concepts for language reasons.
