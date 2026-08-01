---
status: accepted
---

# AGPL-3.0 licence and clean-room anti-copy policy

## Context

The project's purpose is an **open, community-owned** alternative to closed, print-led show-entry bureaux (see the competitor inventory on `research/competitor-inventory`). Two risks threaten that mission: (1) the code being taken and run as a **closed proprietary SaaS** — the incumbent model — giving nothing back; and (2) inadvertently **copying the expression** of an existing competitor product, creating legal exposure. The originating concern for this whole effort was explicitly "make sure I don't copy anything from them."

## Decision

- **Licence: GNU AGPL-3.0.** Network copyleft ensures that anyone offering a modified version _as a network service_ must publish their source, keeping the platform and its improvements open even when hosted. Small clubs self-hosting or using a hosted instance are unaffected.
- **Clean-room anti-copy policy.** The domain model, terminology, and UI are derived from **real kennel-club regulations and original work**, never from a competitor's text, screens, database, or wording. Facts/features aren't copyrightable; expression is.
- **Contributor attestation via DCO** (`Signed-off-by`), not a CLA — lightweight, and it also carries the anti-copy attestation (see `CONTRIBUTING.md`).

## Considered options

- **Apache-2.0 / MIT** — permissive, maximum adoption, patent grant (Apache). Rejected as the primary licence: both permit a **closed-source SaaS fork**, which is the exact risk to the open-community mission.
- **GPL-3.0** — copyleft, but the network-use loophole lets a SaaS operator withhold changes for a hosted app. Weaker than AGPL here.
- **AGPL-3.0** — chosen: its network-copyleft guarantee most directly serves "stays open for the community."
- **CLA instead of DCO** — rejected: heavier contributor friction for little benefit at this stage.

## Consequences

- Some organisations bar AGPL internally; corporate adoption may be lower — acceptable, since community/club adoption is the goal, not corporate embedding.
- A hosted commercial offering is still allowed, but must share its source — aligning commercial use with the open mission.
- Contributors must sign off commits; PRs without DCO sign-off are not merged.
- The clean-room policy constrains how features are researched (cite primary regulations, describe competitor capabilities in original words) — already reflected in the research tickets, which recorded facts only.
