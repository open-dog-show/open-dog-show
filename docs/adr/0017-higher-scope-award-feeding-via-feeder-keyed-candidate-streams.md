---
status: accepted
---

# Higher-scope award feeding via feeder-keyed candidate streams

The breed/group/show variants of `JudgingScopeResults` each carry a single, named candidate bag per variant (`maleCandidates`/`femaleCandidates`, `bobCandidates`, `bigCandidates`). Each bag is implicitly "the feeder" for one higher-scope award, hardcoded by its field name. This can represent only one feeder per scope, so the FCI show scope — which holds **five** awards (BIS, Best Junior, Best Veteran, Best Puppy, Best Minor Puppy), each fed by a different stream — cannot feed four of them, and `AwardPolicy` never enforces `minimumGradeId` above per-sex scope.

## Context

FCI Regulations §7 "Main ring competitions" lists five show-scope individual awards, each with a distinct feeder:

| Award            | Feeder                | Source                                    |
| ---------------- | --------------------- | ----------------------------------------- |
| BIS              | BIG winners           | group-scope award                         |
| Best Junior      | CACIB-J winners       | §7, "EXCELLENT 1st in Junior class"       |
| Best Veteran     | CACIB-V winners       | §7, "EXCELLENT 1st in Veteran class"      |
| Best Puppy       | Puppy class 1st       | complementary rules, "VERY PROMISING 1st" |
| Best Minor Puppy | Minor Puppy class 1st | complementary rules, "VERY PROMISING 1st" |

Two of the five feeders are **class wins, not awards**: the Puppy and Minor Puppy classes grant no award type (`awardTypeIds` empty); the 1st-place dog proceeds directly to Best Puppy / Best Minor Puppy in Show. So a feeder is _either_ an award _or_ a class placement. §7 also lets each NCO run main-ring competitions for native/nationally-recognised breeds, so the feeder set is ruleset-defined, not fixed by the platform.

The same implicit-feeder pattern limits breed and group: BOB draws on **all three** of {CACIB, CACIB-J, CACIB-V} from both sexes (§7), a multi-feeder the single `maleCandidates`/`femaleCandidates` bags express only by convention. `FciAwardPolicy.eligibleAwardTypes` returns every `scope:'show'` award as soon as `bigCandidates` is non-empty, and `validateAwardChoices` returns `{valid:true}` for every non-`per-sex` scope, so `minimumGradeId` is never enforced at breed/group/show scope.

**KMSH cross-check.** The design was verified against the KMSH national layer (`docs/regulations/kmsh-show-regulations.md`) as well as FCI. KMSH ART.33 lists the identical main-ring competitions as FCI §7 — _Beste van de tentoonstelling_ (BIS), _beste veteraan_, _beste jeugd_, _beste puppy_, _beste minor puppy_, plus _beste van de groep_ (BIG) — so the five show-scope awards and their feeders are unchanged under the national layer; the KMSH data layer adds only **per-sex** national awards (CAC, RCAC) and the Fokkersklas (breeder) class, no show-scope awards. KMSH's detailed BOB/BOS procedure (Bijlage 1 §4) reinforces the breed-scope design: BOB draws on {CACIB, CACIB-J, CACIB-V} winners with a "both sexes present" rule and per-sex candidate streams (`1U` = Excellent 1st); BOS is the opposite sex to BOB — confirming the multi-feeder `fedBy` for BOB and that the `sex` tag is breed-scope only (group/show awards are not sex-split). KMSH national awards (CAC/RCAC) and the Fokkersklas feed only per-sex awards and do **not** feed higher scopes (the BOB procedure lists only Junior/Intermediate/Open/Working/Champion/Veteran classes), so `fedBy` being undefined for `per-sex` correctly excludes them.

## Decision

Make the feeder relationship **explicit ruleset data** and the candidate containers **feeder-keyed streams**:

1. **`IndividualAwardType` gains `fedBy?: ReadonlyArray<Feeder>`** for `scope: 'breed' | 'group' | 'show'` (undefined for `per-sex`):

    ```ts
    type Feeder = { awardTypeId: AwardTypeId } | { classId: ClassId };
    ```

    A set, because BOB is a multi-feeder — the adult certificate plus the junior and veteran class wins; single feeders are a one-element array. `fedBy` is authored per Ruleset Layer (ADR-0001): the FCI base layer's BOB feeds on `CACIB` + class wins; the KMSH national layer overrides BOB (wholesale, last-layer-wins) to add the national `CAC` award, which the FCI layer does not know. This is consistent with ADR-0001's data-first rulesets — the feeder relationship is data, not hardcoded policy.

2. **`JudgingScopeResults` breed/group/show variants carry `streams: ReadonlyArray<CandidateStream>`**, replacing the named bags:

    ```ts
    interface CandidateStream {
        feederAwardTypeId: AwardTypeId | undefined;
        feederClassId: ClassId | undefined;
        sex: 'male' | 'female' | undefined; // breed-scope only
        candidates: ReadonlyArray<{ dogRef: string; gradeId: GradeId }>;
    }
    ```

    Candidates are a uniform `{dogRef, gradeId}` — the policy matcher checks only `minimumGradeId` (every higher-scope award has `minimumPlacement: undefined`); picking the 1st-place dog is a construction-time filter in the Judging context, not a policy check. The optional `sex` tag carries breed scope's male/female separation (BOB/BOS); group/show awards are not sex-split.

3. **`AwardPolicy` becomes a generic feeder matcher** across breed/group/show: `eligibleAwardTypes` returns an award id only when at least one candidate across its `fedBy` streams meets the award's `minimumGradeId`; `validateAwardChoices` checks each proposed dog is in an award feeder stream and meets its `minimumGradeId`, and that non-discretionary awards are proposed when their feeder stream is non-empty. No per-scope special-casing of field names.

**Show-type-aware feeding.** `fedBy` lists every feeder an award can use across show types; the matcher matches a feeder only when a corresponding stream is present. The Judging context builds streams only for awards/classes in scope at the show's `ShowType.availableAwardTypeIds`, so out-of-scope feeders match nothing — `AwardPolicy` needs no show-type parameter. Combined with per-layer authoring, this handles the CAC show: the KMSH-layer BOB carries both `CACIB` and `CAC` feeders; at a CAC-only show no CACIB stream exists, so BOB feeds off the CAC stream + class wins (KMSH Bijlage 2 §2-3), while at an FCI CACIB show the FCI-layer BOB (no `CAC` feeder) feeds off CACIB + class wins. `CACIB-J`/`CACIB-V` are per-sex awards (won by those class winners at CACIB shows), not feeders — the class win is the feeder. (KMSH cross-check: Bijlage 1 §4 CACIB-show BOB procedure; Bijlage 2 §2-3 CAC-show BOB procedure.)

The redundant `bigCandidates`/`bobCandidates`/`maleCandidates`/`femaleCandidates` field names are removed; each stream declares its own feeder, so the shape is portable across rulesets. Design decided in #138; implemented in #160.

## Considered options

- **Named fields per feeder (Camp 1)** — add `cacibJCandidates`, `puppyClassWinners`, etc. to the `show` variant. Rejected: hardcodes FCI's exact five feeders into a Published-Language union (a national ruleset adding a sixth show award forces a shape change); keeps the award-named vs class-named inconsistency; does not remove the redundant `bigCandidates` name.
- **Generalized feeder-keyed streams + `fedBy` data (Camp 2)** — chosen: one uniform shape for all higher-scope awards; portable across rulesets; dissolves the redundant field names and the breed/group inconsistency; regulation-faithful (§7's open feeder set).
- **`fedBy` on show-only** — rejected in favour of all higher scopes: putting `fedBy` on every breed/group/show award makes the policy fully generic and lets breed/group drop their inconsistent named fields too, at the cost of a wider change (accepted).
- **Pure award-keyed feeders** — rejected: Best Puppy / Best Minor Puppy are fed by class wins, not awards; keying purely by `awardTypeId` would force inventing non-FCI "Puppy Winner" awards, falsifying the regulations vocabulary. `Feeder` is award-or-class.

## Consequences

- **Downstream integration:** the (not-yet-built) **Judging & Results** context assembles `CandidateStream`s — one per in-scope feeder (BIG winners; BOB winners; the in-scope adult certificate CACIB and/or CAC; junior/veteran/puppy/minor-puppy class wins; sex-tagged where the award is sex-split). This is the real integration surface; the policy change is internal to `@ods/rulesets`.
- **#151:** show-scope validation was deferred to this design; the generic matcher closes that gap.
- **#148 (F11):** the `candidateMeetsBreedMinimumGrade` helper (which ignores `candidate.awardTypeId`) is superseded by generic feeder matching; coordinate so the fix is not duplicated.
- **Ubiquitous language:** add a **Feeder** term to `CONTEXT.md` — the award-or-class source that qualifies a dog as a candidate for a higher-scope award — cross-referenced from `CandidateStream` / `fedBy`.
- **Cost:** a Published-Language shape change (`JudgingScopeResults`) and a new field on a ruleset-owned type; `CandidateEntry` is absorbed (its `awardTypeId` moves to the stream's feeder key).
- **KMSH confirmation + CAC-show refinement:** cross-checked against the KMSH national regulations — ART.33 mirrors FCI §7's main-ring list; Bijlage 1 §4 (CACIB show) and Bijlage 2 §2-3 (CAC show) BOB/BOS procedures confirm the breed-scope multi-feeder + sex-tag decisions and reveal that `fedBy` is show-type-dependent (BOB's adult feeder is CACIB at a CACIB show, CAC at a CAC show; juniors/veterans feed BOB by class win at both). This refines the concrete `fedBy` content — FCI-layer BOB/BOS → `CACIB` + junior/veteran class wins; KMSH-layer overrides BOB/BOS to add `CAC`; Best Junior/Veteran → class wins; `CACIB-J`/`CACIB-V` are no longer feeders — while the four structural decisions hold unchanged. (Out of #138 scope: KMSH ART.4 defines additional show types — CAC, Open, Clubmatch, Young/Veteran days — not yet modelled in the data layer; that is a ShowType-completeness concern, not a feeder-model issue.)
