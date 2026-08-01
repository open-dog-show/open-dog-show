# OpenDogShow — Ubiquitous Language

Ubiquitous language for **OpenDogShow**, an open-source **conformation** ("beauty") dog-show platform. The domain core is **kennel-club-agnostic**; kennel-club-specific rules (FCI, and the Belgian member SRSH/KMSH first) plug in as **rulesets**. Terms are grounded in the FCI Regulations for Dog Shows and the SRSH/KMSH regulations — see `docs/research/` on the `research/*` branches.

The domain splits into bounded contexts — see [`CONTEXT-MAP.md`](./CONTEXT-MAP.md). Terms below are grouped by their **owning context**; each term is owned by exactly one context. When code lands, each context's terms will move to `src/<context>/CONTEXT.md`.

Note on shared vocabulary: **Rulesets** owns the _type/definition_ of `Class`, `Grade`, `Award`, the breed taxonomy, `Show Type`, and the set of `Title` types; other contexts own the _occurrences_ (a Grade given, an Award won). A `Title` is **owner-asserted** data on a Dog (Entries & Registration) — never computed or confirmed by the platform.

## Rulesets

The upstream **Published Language**: it defines the rule vocabulary every other context conforms to.

**Ruleset**:
The named, pluggable bundle of kennel-club rules the core depends on — Classes and their eligibility, breed/group/variety taxonomy, Grade scale, Award types and conditions, and the set of Title types. Each Show runs under exactly one effective Ruleset. Rulesets **compose**: a national member's Ruleset (SRSH/KMSH) layers its national rules on top of the FCI base Ruleset.
_Avoid_: Rulebook, Policy (too generic), Regulation

**Effective Ruleset**:
The resolved, versioned snapshot of the composed Ruleset layers that a Show is judged under, pinned onto the Show at setup so results are immune to later Ruleset edits. The domain core operates only on the Effective Ruleset.
_Avoid_: Resolved Ruleset (acceptable synonym), Merged Ruleset

**Show Type**:
A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open, Breed Special, Young & Veterans Day) that selects which Ruleset layers and Award types are in scope for that Show, and which catalogue-publication rules apply.
_Avoid_: Show Category, Show Class

**Class**:
A competition category into which a Dog is entered, defined by the active Ruleset through an eligibility rule (age window, required title, working qualification). The set of classes and their eligibility is ruleset-owned data, not fixed in the core. A Dog is entered in exactly one compulsory Class per Show; whether a Class is award-eligible is ruleset-defined.
_Avoid_: Category, Division

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
The kennel club governing a jurisdiction and owning its national Ruleset layer (e.g. SRSH/KMSH for Belgium). Authorises Judges and confirms national Awards and Titles.
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

**Title**:
An **owner-asserted** status recorded on a Dog (e.g. Belgian Champion, International Beauty Champion / C.I.B.), maintained by the Owner in their dog administration with supporting evidence. The platform stores Titles but does **not** compute or confirm them; authoritative confirmation is external (NCO / FCI). The set of possible Title types is ruleset-owned vocabulary.
_Avoid_: Championship (when the show type is meant)

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
An optional competition judged on a _group_ of related dogs rather than a single dog. Types: **Brace/Couple** (one dog + one bitch, same breed & variety, same owner), **Breeders' Group** (3–5 dogs of the same breed/variety bred under the same kennel name), **Progeny Group** (a sire or dam with 3–5 first-generation offspring). Each participating Dog must also be individually entered in a compulsory Class at the same Show.
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
The quality rating a Judge gives a Dog in its Class (e.g. Excellent, Very Good, Good, Sufficient, Disqualified, Cannot Be Judged; for puppies Very Promising / Promising / Less Promising). The scale is ruleset-owned.
_Avoid_: Score, Mark, Qualification (acceptable synonym, but prefer Grade)

**Placement**:
The ordinal ranking (1st–4th) a Dog receives within its Class, among Dogs meeting the ruleset's minimum Grade for placement.
_Avoid_: Rank, Position

**Award**:
A discrete honour won at a single Show — e.g. CAC, Reserve CAC, CACIB, Reserve CACIB, CACIB-J/-V, Best of Breed, Best of Opposite Sex, Best in Group, Best in Show. The set of Award types is ruleset-owned. Some Awards require a specific Grade/Placement (e.g. Excellent-1st).
_Avoid_: Prize, Certificate (when a Title certificate is meant)

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
The unit of data isolation on the hosted platform — **one per Club**. A Club's own data (its Shows, rings, classes, catalogues, ring results) is tenant-scoped, isolated by `tenant_id`. Not all data is tenant-scoped: a Dog's owner-asserted administration (`Dog`, `Ownership`, `Title`) is **exhibitor-scoped** and reused across Clubs, and reference/operator data (`Ruleset`, `Ruleset Catalog`, `User`) is **platform-global**. See ADR-0005.
_Avoid_: Account, Organisation (when the isolation unit is meant)

**Ruleset Catalog**:
The curated set of Rulesets and versions installed on the platform and made available for Shows to adopt. Maintained by the Platform Administrator; drawn on by Rulesets when resolving a Show's Effective Ruleset.
_Avoid_: Ruleset Registry, Ruleset Store

## Membership

_(Fog — parked add-on. Not required to enter a Show; no terms defined yet.)_
