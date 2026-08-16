# OpenDogShow — Ubiquitous Language

Ubiquitous language for **OpenDogShow**, an open-source **conformation** ("beauty") dog-show platform. The domain core is **kennel-club-agnostic**; kennel-club-specific rules (FCI, and the Belgian member SRSH/KMSH first) plug in as **rulesets**. Terms are grounded in the FCI Regulations for Dog Shows and the SRSH/KMSH regulations — see `docs/research/` on the `research/*` branches.

The domain splits into bounded contexts — see [`CONTEXT-MAP.md`](./CONTEXT-MAP.md). Terms below are grouped by their **owning context**; each term is owned by exactly one context. When code lands, each context's terms will move to `src/<context>/CONTEXT.md`.

Note on shared vocabulary: **Rulesets** owns the _type/definition_ of `Class`, `Grade`, `Award`, the breed taxonomy, `Show Type`, and the entry-certificate vocabulary; other contexts own the _occurrences_ (a Grade given, an Award won). A `Champion Certificate` is **owner-asserted** data on a Dog (Entries & Registration) — never computed or confirmed by the platform.

## Rulesets

The upstream **Published Language**: it defines the rule vocabulary every other context conforms to.

**Ruleset**:
The named, pluggable bundle of kennel-club rules the core depends on — Classes and their eligibility, breed/group/variety taxonomy, Grade Scales, Award Types, and the entry-certificate vocabulary. Each Show runs under exactly one effective Ruleset. Rulesets **compose**: a national member's Ruleset (SRSH/KMSH) layers its national rules on top of the FCI base Ruleset.
_Avoid_: Rulebook, Policy (too generic), Regulation

**Ruleset Layer**:
One discrete, named slice of kennel-club rules (e.g. the FCI base layer, the SRSH national layer) that contributes to a composed Effective Ruleset. Layers are ordered: the last layer wins when two layers define the same Class — the override is wholesale (the entire Class Definition is replaced, no field-by-field merging). A Show that runs under a national member's rules always has at least two layers: the FCI base and the NCO's national override.
_Avoid_: Ruleset Version, Ruleset Override, Layer (unqualified)

**Effective Ruleset**:
The resolved, versioned snapshot of composed Ruleset Layers that a Show is judged under, stamped with the calendar date on which the layers were composed and which layers were the source. Pinned onto the Show at setup so results are immune to later Ruleset edits. The domain core operates only on the Effective Ruleset.
_Avoid_: Resolved Ruleset (acceptable synonym), Merged Ruleset

**Show Type**:
A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open, Breed Special, Young & Veterans Day) that selects which Ruleset layers and Award types are in scope for that Show, and which catalogue-publication rules apply.
_Avoid_: Show Category, Show Class

**Grade Scale**:
The ruleset-owned ordered set of quality grades a judge assigns within a class, paired with a placeable threshold — the minimum grade for a Dog to receive an ordinal Placement. The FCI adult scale (Excellent → Sufficient) has threshold Very Good; the puppy/minor-puppy scale (Very Promising → Less Promising) has threshold Very Promising. Each Grade Scale also carries its ruleset-defined **Special Outcomes** (Disqualified, Cannot Be Judged). Each Class Definition references one Grade Scale.
_Avoid_: Grading system, Qualification scale

**Special Outcome**:
A non-ordinal result a Judge assigns to a Dog instead of a Grade — specifically Disqualified or Cannot Be Judged. Special Outcomes are defined on the Grade Scale but carry no ordinal position and never qualify a Dog for a Placement. Ruleset-owned.
_Avoid_: Grade (ordinal only), Fault (a different concept)

**Class**:
A competition category into which a Dog is entered, defined by the active Ruleset through a **Class Definition** — an eligibility rule (age window, required entry certificates, optional breeder-handler condition), a Grade Scale, and the Award Types the class feeds. The set of classes and their eligibility is ruleset-owned data, not fixed in the core. A Dog is entered in exactly one compulsory Class per Show; whether a Class is award-eligible is ruleset-defined.
_Avoid_: Category, Division

**Class Definition**:
The ruleset-owned data record for a single Class — its age window (expressed in whole calendar months; FCI phrasing: 'from X months' / 'less than Y months'), the set of required entry certificates (e.g. champion-certificate for Champion Class, working-certificate for Working Class), whether the Bred-by-Exhibitor handler condition applies (handler must be any breeder or co-breeder of the dog), the Grade Scale used, and the Award Types the class feeds. When a national Ruleset layer overrides a class, the entire Class Definition is replaced as a unit. Age is evaluated on the show day; a dog that reaches a month boundary on show day moves to the higher class (FCI 2026; KMSH ART.23). Note: the FCI Bred-by-Exhibitor class becomes mandatory from 2027; the Belgian SRSH layer adds a similar national "Fokkersklas" (Breeder Class) for breed-specific shows under its own Class Definition.
_Avoid_: Class configuration, Class parameters

**Dog Eligibility Profile**:
The dog-side snapshot — date of birth and held certificates — that the Entries & Registration context assembles and passes to the Rulesets context when asking whether a Dog may enter a specific Class. Contains exactly the facts the Rulesets context needs for eligibility evaluation; the full Dog entity stays within Entries & Registration.
_Avoid_: Dog snapshot, Eligibility data

**Award Type**:
The ruleset-owned definition of a single honour that can be proposed in a judging unit. **Individual award types** (scopes: per-sex, breed, group, show) carry a required minimum grade and optional minimum placement (e.g. Excellent-1st for CACIB). **Collective award types** (scope: collective — Best Brace, Best Breeders' Group, Best Progeny Group) carry no grade or placement requirement; their structural validity is governed by the **Collective Award Policy**. Award Types are published as part of the Effective Ruleset.
_Avoid_: Award category

**Award Scope Level**:
One of four levels at which individual-dog Awards are decided in FCI competition, in ascending order: **per-sex** (within one sex of a breed, across all its eligible classes), **breed** (BOB / BOS, from per-sex title-winners of both sexes), **group** (BIG, from the BOB winners of all breeds in the group), **show** (BIS, from the BIG winners). Each Award Type belongs to exactly one scope level. The Award Policy gates which types may be proposed at each level. Collective competition awards (Best Brace/Couple, Best Breeders' Group, Best Progeny Group) exist outside this four-level hierarchy — they are governed by the **Collective Award Policy** and use a distinct **collective** scope.
_Avoid_: Judging Round, Judging Phase

**Award Policy**:
The ruleset-owned rules that answer two questions for a given Award Scope Level and its results: (a) which Award Types may the Judge propose, and (b) are the Judge's proposed assignments valid? For example, the FCI Award Policy permits CACIB only when an Excellent-1st dog is present in a CACIB-eligible Class, and rejects a CACIB proposed for a dog with a lower grade. Stateless — evaluated once per scope, from that scope's placements or candidates alone. Applies to individual class/scope judging (the four Award Scope Levels); Collective Competitions are governed by the **Collective Award Policy**. Part of the Rulesets' Published Language.
_Avoid_: Award Rules (too generic), Eligibility Rules (misses the validation half)

**Collective Award Policy**:
The ruleset-owned rules that validate whether a Collective Competition is structurally valid — e.g. Brace/Couple has exactly one Dog and one Bitch; Breeders' Group and Progeny Group have 3–5 participants. Evaluates one group in isolation and, when valid, returns the winning group (all participating entry refs — a Collective Competition has no internal ranking). Distinct from Award Policy, which governs individual class/scope judging. Part of the Rulesets' Published Language.
_Avoid_: Group Award Policy, Collective Award Rules

**Breed**:
An officially recognised breed, classified into one Group and described by a Breed Standard. Its recognition status (definitive / provisional / unrecognised) gates award eligibility. The breed list and classification are ruleset-owned reference data.
_Avoid_: Type

**Variety**:
A subdivision of a Breed (by size, coat, or colour) that is judged separately for awards — awards such as the CACIB are made per Breed **and** Variety.
_Avoid_: Sub-breed, Type

**Breed Standard**:
The official description of the ideal specimen of a Breed, owned by the country of origin and published by the governing body. Judges assess Dogs against it.
_Avoid_: Standard (when ambiguous)

**Group**:
One of the governing body's top-level breed groupings (the FCI defines 10). Used for catalogue division and the **Best in Group** competition. Ruleset-owned.
_Avoid_: Breeders' Group / Progeny Group (those are Collective Competitions)

**National Canine Organisation (NCO)**:
The kennel club governing a jurisdiction and owning its national Ruleset layer (e.g. SRSH/KMSH for Belgium). Authorises Judges and confirms national Awards and Champion Certificates.
_Avoid_: Kennel Club (when the generic body is meant), Federation

## Show Organisation

Owns the Show and its setup; upstream to Entries, Judging, and Catalogue.

**Show**:
A single dated, sanctioned conformation exhibition run by an organising Club under one Effective Ruleset. It owns exactly one catalogue and one set of per-breed / per-sex awards for that date. Several Shows may occur on the same calendar date.
_Avoid_: Event, Session, Meeting

**Show Cluster**:
A grouping of Shows held together (typically a weekend), where each Show remains an independent unit with its own catalogue and awards.
_Avoid_: Show Weekend, Circuit

**Club**:
The organising body responsible for running a Show. Registers on the platform and appoints a Show Secretary.
_Avoid_: Society (acceptable synonym), Organiser

**Show Secretary**:
The Club officer who administers a Show — configures its classes and rings, manages entries, generates the Catalogue, and records results.
_Avoid_: Show Organiser (acceptable synonym), Secretary (unqualified)

**Ring**:
A physical judging space at a Show where a Judge officiates, with an assigned running order.
_Avoid_: Arena

## Entries & Registration

Owns dog identity, entries, and the entrant-side people.

**Dog**:
A registered pedigree dog with a lasting identity (studbook + studbook number, microchip/tattoo, breed & variety, sex, date of birth, breeder). It exists independently of any Show and is reused across many Entries.
_Avoid_: Exhibit, Animal

**Sex**:
Whether a Dog is Male or Female. The two sexes are judged and awarded separately (e.g. one CACIB per sex per breed/variety). Canonical model values are **Male / Female**; the catalogue and printed display terms are **Dog** (male) and **Bitch** (female).
_Avoid_: Gender

**Pedigree**:
The certified ancestry record of a Dog, issued from an NCO's Studbook.
_Avoid_: Papers

**Studbook**:
The NCO register of recognised dogs. A Dog's identity references its Studbook and studbook number.
_Avoid_: Registry (when the specific book is meant)

**Kennel Name**:
The registered breeder's name (affix) that forms part of a Dog's registered name; the basis for Breeders' Group eligibility.
_Avoid_: Affix (acceptable synonym, but prefer Kennel Name), Prefix

**Champion Certificate**:
An **owner-asserted** certificate held by a Dog (e.g. International Beauty Champion / C.I.B., Champion Belge de Beauté), recorded by the Owner with supporting evidence. The platform stores Champion Certificates but does **not** compute or confirm them; authoritative confirmation is external (NCO / FCI).
_Avoid_: Title (acceptable FCI synonym), Championship (when the show type is meant)

**Working Certificate**:
An **owner-asserted** certificate (WCC — Working Class Certificate) confirming a Dog has passed a breed-specific working test, required to enter Working Class at any show where that class is offered. Issued by the NCO in which the test was held. The platform stores Working Certificates but does not administer the tests.
_Avoid_: WCC (acceptable abbreviation)

**Vaccination Certificate**:
An **owner-asserted** certificate confirming a Dog has current valid vaccinations. May be required as an entry certificate for certain Classes (configured in the Class Definition). The platform stores but does not verify vaccination records.
_Avoid_: Health certificate, Vaccination record

**Ownership**:
The single owner or owner-partnership responsible for a Dog at a Show. Every Entry belongs to exactly one Ownership (the "one ownership per entry" rule).
_Avoid_: Owner (when a partnership may be meant)

**Owner**:
A person recorded as owning a Dog on its pedigree/studbook. One or more Owners make up an Ownership.
_Avoid_: Keeper

**Handler**:
The person who presents (shows) a Dog to the Judge in the ring. May be an Owner or an agent. The rules on minor handlers and the prohibition on "double handling" attach to this role.
_Avoid_: Steward (a different role)

**Exhibitor**:
The party responsible for an Entry — the account holder who enters a Dog and pays. Usually an Owner, but distinct from who owns or shows the Dog.
_Avoid_: Entrant

**Entry**:
The record of entering one Dog into one Show in exactly one compulsory Class, optionally with paid extras (e.g. catalogue, parking). Belongs to exactly one Ownership.
_Avoid_: Registration, Booking

**Collective Competition**:
An optional competition judged on a _group_ of related dogs rather than a single dog. Types: **Brace/Couple** (one dog + one bitch, same breed & variety, same owner), **Breeders' Group** (3–5 dogs of the same breed/variety bred under the same kennel name), **Progeny Group** (a sire or dam with 3–5 first-generation offspring). Each participating Dog must also be individually entered in a compulsory Class at the same Show. Won as a unit — all participants are co-winners; there is no internal ranking within the group. Structural validity is governed by the **Collective Award Policy** (Rulesets).
_Avoid_: Group class (clashes with FCI Group), Team class

**Team**:
The specific set of Dogs entered together into one Collective Competition — the group-level counterpart of an Entry.
_Avoid_: Group (clashes with FCI Group), Squad

## Judging & Results

Owns the ring outcomes (per-Show) and the ring officials.

**Judge**:
The person appointed to assess Dogs against the Breed Standard and decide gradings, placements and awards. Sole authority in the ring; must be authorised by a National Canine Organisation for the breeds judged.
_Avoid_: Referee, Adjudicator

**Ring Steward**:
The Judge's assistant in the ring — collects classes, checks absentees, manages paperwork and award distribution. Not a judging role.
_Avoid_: Marshal, Steward (unqualified)

**Grade**:
The ordinal quality rating a Judge gives a Dog in its Class (e.g. Excellent, Very Good, Good, Sufficient; for puppies Very Promising / Promising / Less Promising). Only Dogs meeting the ruleset's minimum Grade for their Grade Scale receive an ordinal Placement. The Grade Scale is ruleset-owned. Disqualified and Cannot Be Judged are not Grades — see **Special Outcome** (Rulesets).
_Avoid_: Score, Mark, Qualification (acceptable synonym, but prefer Grade)

**Placement**:
The ordinal ranking (1st–4th) a Dog receives within its Class, among Dogs meeting the ruleset's minimum Grade for placement.
_Avoid_: Rank, Position

**Award**:
A discrete honour proposed or won at a single Show — e.g. CAC, Reserve CAC, CACIB, Reserve CACIB, CACIB-J/-V, Best of Breed, Best of Opposite Sex, Best in Group, Best in Show, Best Junior, Best Veteran, Best Puppy, Best Minor Puppy; and for collective competitions: Best Brace/Couple, Best Breeders' Group, Best Progeny Group. The set of Award types is ruleset-owned. Some Awards require a specific Grade/Placement (e.g. Excellent-1st for CACIB); which types may be proposed at each **Award Scope Level** and whether proposed choices are valid is governed by the **Award Policy** (both Rulesets). International Awards such as the CACIB are **proposals** at show time, subject to later confirmation by the FCI or NCO.
_Avoid_: Prize, Certificate (when a Champion Certificate is meant)

## Catalogue & Publishing

Owns the Catalogue (produced after entries close, published under ruleset timing rules) and results publication (live or post-show).

**Catalogue**:
The official per-Show publication listing every Entry in ruleset-defined order (Group → Breed → Variety → Sex → Class) with continuous numbering. Produced after entries close; its online-publication timing is governed by the Effective Ruleset. A Dog not in the Catalogue cannot be judged, barring a show-committee error.
_Avoid_: Programme, Listing

**Running Order**:
The published sequence in which Dogs are called into a Ring. May be published ahead of, or updated live during, the Show.
_Avoid_: Schedule (that is the show programme), Lineup

## Payments

Owns entry-fee collection; a generic context behind an anticorruption layer to an external provider.

**Entry Fee**:
The amount charged to enter one Dog in a Show; may vary by Class or timing.
_Avoid_: Ticket price, Charge

**Payment**:
A record of collecting an Entry Fee (and any paid extras) for an Entry through an external payment provider.
_Avoid_: Transaction, Charge

## Identity & Access

Owns platform accounts and permissions; a generic context behind an anticorruption layer to an external identity provider.

**User**:
An authenticated platform account. Domain roles (Exhibitor, Show Secretary, Judge, Platform Administrator) are granted to Users as permissions; one person may hold several roles.
_Avoid_: Account (acceptable synonym), Login

## Platform Administration

The platform operator's back office — cross-club responsibilities no single Club owns. Upstream to Show Organisation (provisions Clubs) and Rulesets (curates the available rulesets).

**Platform Administrator**:
The operator of the platform instance. Onboards Clubs, curates the Ruleset Catalog, and manages global configuration and cross-club user administration. The highest-privilege User role.
_Avoid_: Superuser, Root, Sysadmin

**Tenant**:
The unit of data isolation on the hosted platform — **one per Club**. A Club's own data (its Shows, rings, classes, catalogues, ring results) is tenant-scoped, isolated by `tenant_id`. Not all data is tenant-scoped: a Dog's owner-asserted administration (`Dog`, `Ownership`, `Champion Certificate`) is **exhibitor-scoped** and reused across Clubs, and reference/operator data (`Ruleset`, `Ruleset Catalog`, `User`) is **platform-global**. See ADR-0005.
_Avoid_: Account, Organisation (when the isolation unit is meant)

**Ruleset Catalog**:
The curated set of Rulesets and versions installed on the platform and made available for Shows to adopt. Maintained by the Platform Administrator; drawn on by Rulesets when resolving a Show's Effective Ruleset.
_Avoid_: Ruleset Registry, Ruleset Store

## Membership

_(Fog — parked add-on. Not required to enter a Show; no terms defined yet.)_
