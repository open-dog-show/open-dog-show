# Research: Data-ownership / isolation ("scoping") regimes

**Date:** 2026-08-01 · **Trigger:** grilling session for issue #13 (kernel `EventScope` +
ADR-0004 RLS model) · **Type:** research spike (read-only; no code or existing docs changed).

> **Placement note.** The repo convention (see `CONTEXT.md`, `docs/domain-invariants.md`)
> is that research notes live in `docs/research/` **on `research/*` branches**, not on
> `main`. This file was created on the current working branch to unblock the grill; it
> should be moved onto a `research/*` branch (e.g. `research/data-ownership-scopes`) before
> or instead of landing on `main`.

---

## Summary answer

There are **three active scoping regimes today**, not the single "`tenant_id` on every
table" regime ADR-0004 implies:

1. **tenant (Club)** — durable data owned by one organising Club: Shows, rings, classes,
   catalogues, per-show ring results. RLS key `tenant_id` (= `clubId`).
2. **exhibitor / owner (participant, cross-tenant)** — the owner's durable "dog
   administration" reused across many Clubs: `Dog`, `Ownership`, `Pedigree` reference,
   `Title` (owner-asserted). RLS key `accountId` / `ownerId`.
3. **platform / global** — reference data and operator data that no Club owns: `Ruleset`,
   `Ruleset Catalog`, Platform Administration config, `User` accounts. No `tenant_id`; not
   Club-isolated.

Two further scopes are **latent and should be deferred**, documented but not seeded:

4. **judge (`judgeId`)** — *defer*. Today a Judge owns no isolated on-platform dataset:
   ring assignments and results are Club-scoped, and breed authorisation is NCO reference
   data. It becomes a real scope only when a judge self-service surface is built
   (availability calendar, cross-club profile, portable critiques).
5. **nco (`ncoId`)** — *defer / external*. The NCO is an external authority (studbook,
   judge authorisation, CAC/title confirmation). It becomes an internal scope only if NCOs
   are given platform accounts to confirm awards/titles on-platform.

Recommended seed for the kernel: keep `EventScope` an **extensible discriminated union**
seeded with `{ tenant, exhibitor, platform }`; reserve `judge` and `nco` as documented,
un-seeded variants. **Do not add `judge` now.**

---

## Party → ownership → scope table

| Party | Owns durable isolated data? | RLS key | Scope regime | Notes |
| --- | --- | --- | --- | --- |
| **Club** | **Yes** — Shows, rings, classes, catalogues, ring results | `tenant_id` (`clubId`) | **tenant** | *The* tenant ("Platform Administration onboards Clubs (tenants)"). Consistency boundary of a Show. |
| **Show Secretary** | No — acts *within* a Club | inherits `tenant_id` | tenant | A `User` granted a Club-scoped role; not a separate owner ([CONTEXT.md](../../CONTEXT.md), Show Organisation). |
| **Exhibitor / Owner** | **Yes** — `Dog`, `Ownership`, `Pedigree` ref, `Title`, entry history | `accountId` / `ownerId` | **participant (cross-tenant)** | The owner's durable "dog administration"; a `Dog` "exists independently of any Show and is reused across many Entries." |
| **Judge** | **Not yet** — assignment + results are Club-scoped; authorisation is NCO reference | `judgeId` *(deferred)* | latent participant | Referenced by id on assignments/results. Would own data only with a self-service surface. See §Judge. |
| **NCO** | External — studbook, judge authorisation, CAC/title confirmation | `ncoId` *(deferred)* | global / external | Authoritative confirmation is external (NCO/FCI). See §NCO. |
| **Platform operator** | **Yes** — `Ruleset`, `Ruleset Catalog`, global config, `User` accounts | none (global) | **platform / global** | Reference + operator data; not Club-isolated. |
| **Handler** | No | reference on `Entry` / presentation | n/a (reference) | A person presenting a Dog in the ring; owns data only if also an Exhibitor account. |
| **Breeder** | No — kennel name is an attribute of the `Dog` | reference on `Dog` | n/a (reference) | `Kennel Name` is part of the Dog's registered identity; a scope only if breeders get a portable kennel/litter surface (not modelled). |
| **Ring Steward** | No | inherits `tenant_id` | tenant | Per-show role assisting the Judge; Club-scoped assignment; NCO-accredited (reference). |

---

## Judge — is it a distinct scope?

**Recommendation: not now; reserve `judge(judgeId)` for later.**

What the sources establish about a Judge:

- A Judge is **authorised by an NCO for specific breeds** and is the **sole authority in the
  ring**; may judge only breeds their NCO authorises
  (`docs/domain-invariants.md` Judging & Results; FCI Show Regs §10, §12, via
  `research/belgium-ruleset:docs/research/belgium-srsh-show-rules.md` §5).
- A Judge **officiates across many Clubs/Shows** — a cross-club official, like an Exhibitor
  is a cross-club participant.
- Conflict-of-interest rules attach to the Judge (no dog they/family owned, co-owned,
  conditioned, kept or sold in the preceding 6 months), but the platform treats these as
  **advisory** because ownership history is often unknown (`docs/domain-invariants.md`).

Classify the three kinds of "judge data":

1. **NCO-authorised reference data** — the Judge's authorised breeds / licence (the FCI
   Judges Directory listing; SRSH "approval of judges" via its sport service,
   `belgium-srsh-show-rules.md` §5). This is **reference data owned by the NCO/platform**,
   *not* owned by the Judge. Even if surfaced on-platform, a Judge cannot self-assert their
   own competencies — same shape as `Title` being owner-*asserted* but authoritatively
   confirmed elsewhere.
2. **Club-scoped assignment + results** — a Judge is invited/assigned to a Ring at a Show,
   and the grades/placements/awards they record are **per-Show, tenant-scoped** data owned
   by the Club (`docs/domain-invariants.md` Judging & Results; `CONTEXT-MAP.md`). The Judge
   is a foreign `judgeId` reference on those rows, not their owner.
3. **Hypothetical judge-owned durable data** — an availability calendar, a cross-club
   professional profile, or **portable critiques** the Judge carries between Clubs. *This is
   the only category that would need a `judgeId` isolation key* — and none of it exists in
   the current model (there is no Judge self-service context in `CONTEXT-MAP.md`).

**Conclusion.** Judge is a *latent* fourth scope. Until a judge self-management surface is
designed, all judge-associated data is either Club-scoped (category 2) or platform/NCO
reference (category 1). Adding `judge` to `EventScope` now would be speculative. Reserve it.

---

## NCO — why external/platform now

**Recommendation: external now; `nco(ncoId)` only if NCOs get platform accounts.**

The NCO ("National Canine Organisation", e.g. SRSH/KMSH for Belgium) is defined as *the
kennel club governing a jurisdiction* that "owns its national Ruleset layer... Authorises
Judges and confirms national Awards and Titles" (`CONTEXT.md`, Rulesets). Every authoritative
act the NCO performs is, in the current model, **external to the platform**:

- **Studbook & Pedigree** — issued from an NCO's Studbook; the `Dog` merely *references* its
  studbook + number (`CONTEXT.md`, Entries & Registration). The platform stores the
  reference, not the register.
- **Judge authorisation** — NCO reference data (see §Judge).
- **Award / title confirmation** — FCI-CACIB is a **proposal "subject to confirmation by the
  FCI"** confirmed later by the FCI Head Office; the national **CAC** and champion titles are
  confirmed by the NCO (`research/fci-ruleset:docs/research/fci-international-show-rules.md`
  §2, §8; `belgium-srsh-show-rules.md` §3). Crucially, **`Title` is owner-asserted** — "the
  platform stores Titles but does **not** compute or confirm them; authoritative confirmation
  is external (NCO / FCI)" (`CONTEXT.md`; ADR-0002 removed the Titles context precisely for
  this reason).

So the NCO's durable data lives in *its own* systems; the platform holds either
owner-asserted claims (Titles) or reference snapshots (studbook number, ruleset layer). The
ruleset layer the NCO authors is curated into the platform as **platform/global** reference
data (`Ruleset Catalog`), not as NCO-isolated tenant data.

**What would make NCO an internal scope:** giving NCOs **platform accounts** to *confirm*
awards/titles on-platform (turning today's external, owner-asserted `Title` and "proposal"
awards into platform-confirmed records). That would create durable NCO-owned rows needing an
`ncoId` isolation key. ADR-0004's own open risk — "whether any... National Canine
Organisation will *require* self-hosting / on-prem data is unquantified (research Q4)"
(`docs/research/adr-0004-language-integration.md` Q4) — is the same latent NCO-as-first-class
question. Defer until such a surface is on the roadmap.

---

## Hybrid / dual-visibility cases

The single-`tenant_id` model breaks on rows that legitimately belong to a Club **and** are
visible to a participant. The fix is to separate **ownership scope** (who the aggregate/fact
belongs to → drives `EventScope`) from the **RLS read predicate** (who may see the row →
may be a *disjunction*).

- **Entry** — created by an Exhibitor, but entered *into a Show* whose closing dates,
  catalogue numbering and "one Dog / one compulsory Class per Show" invariants all live in
  the host Club's consistency boundary (`docs/domain-invariants.md` Entries & Registration).
  - **Ownership scope: tenant (host Club).** The `Entry` aggregate lives in the Club tenant.
  - **Read predicate: `tenant_id = current_club OR exhibitorId = current_account`** — the
    creating Exhibitor must see/manage their own entries across Clubs.
  - It **references** an exhibitor-scoped `Dog` (cross-tenant) and every Entry "belongs to
    exactly one Ownership."
- **Payment** — collecting an Entry Fee for an Entry (`CONTEXT.md`, Payments). Visible to the
  **Exhibitor** (their payment), the **Club** (its revenue), and potentially the **operator**
  (billing). Behind an ACL to an external provider.
  - **Read predicate: `tenant_id = current_club OR accountId = current_account`** (+ operator
    override).
- **Dog / Title** — exhibitor-owned (`accountId`) but read by **many** Clubs' catalogues and
  results. Each Club's `Catalogue` holds a **tenant-scoped snapshot** of the Dog's data taken
  at entry time (catalogue numbering is immutable once published), referencing the
  exhibitor-scoped `Dog` by id. Cross-tenant reuse without shared mutable rows (ADR-0002:
  reference-by-ID).
- **Award / result** — a Club-scoped fact, but the Exhibitor wants a cross-club award history
  for their Dog; that is assembled in an exhibitor read model from `AwardGranted` events, not
  by widening the source row's scope. Award *confirmation* stays external (NCO/FCI).
- **Catalogue** — not private-vs-private isolation but a **time-gated public visibility**:
  private to the Club until the ruleset's publication window, then public (FCI: show day
  only, ≤2h before opening, no personal data earlier) (`docs/domain-invariants.md`
  Catalogue & Publishing; `belgium-srsh-show-rules.md` §4). RLS must model a "public after
  timestamp" predicate, which `tenant_id`-only cannot express.

---

## Recommendation: final `EventScope` and RLS-key-per-table

### `EventScope` variant set (kernel)

```ts
// Extensible discriminated union. Seed three; reserve two (documented, un-seeded).
type EventScope =
  | { kind: 'tenant';    tenantId: TenantId }     // Club-owned show data
  | { kind: 'exhibitor'; accountId: AccountId }   // owner's cross-club dog administration
  | { kind: 'platform' };                          // reference + operator data
  // Reserved for later (do NOT seed yet):
  // | { kind: 'judge'; judgeId: JudgeId }        // when a judge self-service surface exists
  // | { kind: 'nco';   ncoId: NcoId }            // when NCOs confirm awards/titles on-platform
```

`EventScope` records **who a fact belongs to**. It is **not** the same as a row's RLS read
predicate: hybrid rows (Entry, Payment) have a `tenant` ownership scope but a **disjunctive**
read predicate that also admits the participant. Document the two as distinct concerns.

### RLS-key-per-table implication (per context)

| Context | Representative tables | RLS key / predicate | Regime |
| --- | --- | --- | --- |
| Rulesets | `Ruleset`, `GradeScale`, `AwardType`, breed taxonomy | none (global read) | platform |
| Platform Administration | `Ruleset Catalog`, global config | none (operator-only) | platform |
| Identity & Access | `User` accounts | subject = `accountId` (not a tenant) | platform/global |
| Show Organisation | `Show`, `Ring`, `Class`, `Effective Ruleset` snapshot | `tenant_id` (`clubId`) | tenant |
| Entries & Registration (dog admin) | `Dog`, `Ownership`, `Pedigree` ref, `Title` | `accountId` / `ownerId` | participant (cross-tenant) |
| Entries & Registration (entry loop) | `Entry`, `Team` | `tenant_id = club OR exhibitorId = account` | **hybrid** |
| Judging & Results | `Grade`, `Placement`, `Award`, ring assignment, critique | `tenant_id` (`clubId`); `judgeId` = FK only | tenant |
| Catalogue & Publishing | `Catalogue`, running order, results read model | `tenant_id` **+ public-after-timestamp** | tenant → public |
| Payments | `Payment` | `tenant_id = club OR accountId = account` (+ ACL) | **hybrid** |

**Net:** the RLS key is **not uniform**. ADR-0004 should be amended from "`tenant_id` + RLS
on every table" to "**a scope-appropriate isolation key per table** — `tenant_id` for Club
show data, `accountId`/`ownerId` for cross-tenant dog administration, none for
platform/reference data, and a **disjunctive predicate** for hybrid rows (Entry, Payment) —
with a time-gated public predicate for published catalogues." "Single-tenant = one
`tenant_id`" still holds for Club data but does **not** describe exhibitor, platform, or
hybrid data.

---

## Sources

**Repo docs (current branch):**
- `CONTEXT.md` — ubiquitous language: Club, Exhibitor, Owner/Ownership, Handler, Breeder,
  Judge, Ring Steward, Show Secretary, NCO, Dog, Title, Studbook, Pedigree, Rulesets,
  Ruleset Catalog, Platform Administrator, User.
- `CONTEXT-MAP.md` — bounded contexts, integration by domain events + reference-by-ID,
  "Platform Administration → Show Organisation: onboards/provisions Clubs (tenants)".
- `docs/domain-invariants.md` — Show Organisation, Entries & Registration, Judging & Results,
  Catalogue & Publishing invariants (incl. advisory judge conflict-of-interest, owner-asserted
  Titles, catalogue publication timing).
- `docs/adr/0001-kennel-club-rulesets-as-data-first-policies.md` — Titles owner-asserted (no
  title policy); ruleset owns vocabulary.
- `docs/adr/0002-bounded-contexts-and-event-driven-integration.md` — nine contexts;
  Titles-not-a-context; Platform Administration onboards Clubs (tenants).
- `docs/adr/0004-tech-stack-typescript-modular-monolith-postgres.md` — the "`tenant_id` + RLS,
  single-tenant = one `tenant_id`" model this note refines.

**Research notes (on `research/*` branches, read via `git show`):**
- `research/fci-ruleset:docs/research/fci-international-show-rules.md` — FCI Regulations for
  Dog Shows + International Championship: CACIB proposal→confirmation by FCI Head Office (§2,
  §8), judge authority/competency (§10–12), title economics, class list.
- `research/belgium-ruleset:docs/research/belgium-srsh-show-rules.md` — SRSH/KMSH national
  layer: sport service approves judges / confirms CAC (§5), roles (judge, ring steward,
  organiser, exhibitor/handler/owner), catalogue rules (§4), Belgian titles (§3).
- `research/adr-0004-language-integration:docs/research/adr-0004-language-integration.md` —
  Q4: multi-tenant hosted instance as primary channel; NCO/club on-prem self-hosting is an
  unquantified open risk (the NCO-as-first-class latent question).

**Primary regulation sources (cited within the research notes):**
- FCI — Regulations for FCI Dog Shows — `https://www.fci.be/medias/EXP-REG-en-20260101-22363.pdf`
  (and consolidated `.../EXP-REG-en-20270101-22481.pdf`).
- FCI — Regulations for the FCI International Championship — `https://www.fci.be/medias/FCI-REG-TIT-en-19872.pdf`.
- SRSH/KMSH — Conditions d'obtention du titre de Champion Belge —
  `https://www.srsh.be/sites/default/files/Titre%20-%20Conditions%20d'obtention%20titre%20de%20champion%20belge.pdf`;
  sport service — `https://www.srsh.be/fr/sport`.
