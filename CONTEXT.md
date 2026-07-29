# Dog Show Platform

Ubiquitous language for an open-source **conformation** ("beauty") dog-show platform. The domain core is **kennel-club-agnostic**; kennel-club-specific rules (FCI, and the Belgian member SRSH/KMSH first) plug in as **rulesets**. Terms are grounded in the FCI Regulations for Dog Shows and the SRSH/KMSH regulations — see `docs/research/` on the `research/*` branches.

This is a single-context glossary for now. When the bounded-context map is decided, this may split into per-context glossaries under a `CONTEXT-MAP.md`.

## Language

### Show structure

**Show**:
A single dated, sanctioned conformation exhibition run by an organising club under one ruleset. It owns exactly one catalogue and one set of per-breed / per-sex awards for that date. Several Shows may occur on the same calendar date.
_Avoid_: Event, Session, Meeting

**Show Cluster**:
A grouping of Shows held together (typically a weekend), where each Show remains an independent unit with its own catalogue and awards.
_Avoid_: Show Weekend, Circuit

### Entries & participation

**Dog**:
A registered pedigree dog with a lasting identity (studbook + studbook number, microchip/tattoo, breed & variety, sex, date of birth, breeder). It exists independently of any Show and is reused across many Entries.
_Avoid_: Exhibit, Animal

**Ownership**:
The single owner or owner-partnership responsible for a Dog at a Show. Every Entry belongs to exactly one Ownership (the "one ownership per entry" rule).
_Avoid_: Owner (when a partnership may be meant)

**Entry**:
The record of entering one Dog into one Show in exactly one compulsory class, optionally with paid extras (e.g. catalogue, parking). Belongs to exactly one Ownership.
_Avoid_: Registration, Booking

**Collective Competition**:
An optional competition judged on a *group* of related dogs rather than a single dog. Types: **Brace/Couple** (one dog + one bitch, same breed & variety, same owner), **Breeders' Group** (3–5 dogs of the same breed/variety bred under the same kennel name), **Progeny Group** (a sire or dam with 3–5 first-generation offspring). Each participating Dog must also be individually entered in a compulsory class at the same Show.
_Avoid_: Group class (clashes with FCI Group), Team class

**Team**:
The specific set of Dogs entered together into one Collective Competition — the group-level counterpart of an Entry.
_Avoid_: Group (clashes with FCI Group), Squad

### Breed & class taxonomy

**Class**:
A competition category into which a Dog is entered, defined by the active **ruleset** through an eligibility rule (age window, required title, working qualification). The set of classes and their eligibility is ruleset-owned data, not fixed in the core. A Dog is entered in exactly one compulsory Class per Show; whether a Class is award-eligible is ruleset-defined.
_Avoid_: Category, Division

**Sex**:
Whether a Dog is Male or Female. The two sexes are judged and awarded separately (e.g. one CACIB per sex per breed/variety). Canonical model values are **Male / Female**; the catalogue and printed display terms are **Dog** (male) and **Bitch** (female).
_Avoid_: Gender

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

### People & roles

**Owner**:
A person recorded as owning a Dog on its pedigree/studbook. One or more Owners make up an Ownership.
_Avoid_: Keeper

**Handler**:
The person who presents (shows) a Dog to the Judge in the ring. May be an Owner or an agent. The rules on minor handlers and the prohibition on "double handling" attach to this role.
_Avoid_: Steward (a different role)

**Exhibitor**:
The party responsible for an Entry — the account holder who enters a Dog and pays. Usually an Owner, but distinct from who owns or shows the Dog.
_Avoid_: Entrant

**Judge**:
The person appointed to assess Dogs against the Breed Standard and decide gradings, placements and awards. Sole authority in the ring; must be authorised by a National Canine Organisation for the breeds judged.
_Avoid_: Referee, Adjudicator

**Ring Steward**:
The Judge's assistant in the ring — collects classes, checks absentees, manages paperwork and award distribution. Not a judging role.
_Avoid_: Marshal, Steward (unqualified)

### Results & awards

**Grade**:
The quality rating a Judge gives a Dog in its class (e.g. Excellent, Very Good, Good, Sufficient, Disqualified, Cannot Be Judged; for puppies Very Promising / Promising / Less Promising). The scale is ruleset-owned.
_Avoid_: Score, Mark, Qualification (acceptable synonym, but prefer Grade)

**Placement**:
The ordinal ranking (1st–4th) a Dog receives within its class, among Dogs meeting the ruleset's minimum Grade for placement.
_Avoid_: Rank, Position

**Award**:
A discrete honour won at a single Show — e.g. CAC, Reserve CAC, CACIB, Reserve CACIB, CACIB-J/-V, Best of Breed, Best of Opposite Sex, Best in Group, Best in Show. The set of Award types is ruleset-owned. Some Awards require a specific Grade/Placement (e.g. Excellent-1st).
_Avoid_: Prize, Certificate (when a Title certificate is meant)

**Title**:
An accumulated status a Dog earns over time by collecting Awards under ruleset conditions (e.g. Belgian Champion, International Beauty Champion / C.I.B.). Distinct from any single Award. Ruleset-owned.
_Avoid_: Championship (when the show type is meant)

### Rulesets & governance

**Ruleset**:
The named, pluggable bundle of kennel-club rules the core depends on — Classes and their eligibility, breed/group/variety taxonomy, Grade scale, Award types and conditions, and Title rules. Each Show runs under exactly one effective Ruleset. Rulesets **compose**: a national member's Ruleset (SRSH/KMSH) layers its national rules on top of the FCI base Ruleset.
_Avoid_: Rulebook, Policy (too generic), Regulation

**National Canine Organisation (NCO)**:
The kennel club governing a jurisdiction and owning its national Ruleset layer (e.g. SRSH/KMSH for Belgium). Authorises Judges and confirms national Awards and Titles.
_Avoid_: Kennel Club (when the generic body is meant), Federation

**Show Type**:
A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open, Breed Special, Young & Veterans Day) that selects which Ruleset layers and Award types are in scope for that Show.
_Avoid_: Show Category, Show Class

**Effective Ruleset**:
The resolved, versioned snapshot of the composed Ruleset layers that a Show is judged under, pinned onto the Show at setup so results are immune to later Ruleset edits. The domain core operates only on the Effective Ruleset.
_Avoid_: Resolved Ruleset (acceptable synonym), Merged Ruleset

### Registration & publication

**Pedigree**:
The certified ancestry record of a Dog, issued from an NCO's Studbook.
_Avoid_: Papers

**Studbook**:
The NCO register of recognised dogs. A Dog's identity references its Studbook and studbook number.
_Avoid_: Registry (when the specific book is meant)

**Kennel Name**:
The registered breeder's name (affix) that forms part of a Dog's registered name; the basis for Breeders' Group eligibility.
_Avoid_: Affix (acceptable synonym, but prefer Kennel Name), Prefix

**Catalogue**:
The official per-Show publication listing every Entry in ruleset-defined order (Group → Breed → Variety → Sex → Class) with continuous numbering. A Dog not in the Catalogue cannot be judged, barring a show-committee error.
_Avoid_: Programme, Listing

**Entry Fee**:
The amount charged to enter one Dog in a Show; may vary by Class or timing. Collected through the platform's payment loop.
_Avoid_: Ticket price, Charge
