# OpenDogShow

Open-source platform for running **conformation ("beauty") dog shows** — online entries, judging, catalogue, and results — built to keep the cost of organising a show **low for small clubs**.

The domain core is **kennel-club-agnostic**: kennel-club rules (FCI, and the Belgian member SRSH/KMSH first; AKC/KC later) plug in as composable **rulesets**, so the platform is not tied to one jurisdiction. It is a clean-room design derived from real kennel-club regulations — never from any competitor's product.

## Design

Domain-model-first, DDD + clean architecture, framework-agnostic ("don't marry the framework").

- **Ubiquitous language:** [`CONTEXT.md`](./CONTEXT.md)
- **Bounded-context map:** [`CONTEXT-MAP.md`](./CONTEXT-MAP.md)
- **Core domain invariants:** [`docs/domain-invariants.md`](./docs/domain-invariants.md)
- **Architecture decisions:** [`docs/adr/`](./docs/adr/)
- **Research (primary sources):** on `research/*` branches under `docs/research/`

## Status

Domain-model spec complete; build phase next.

## Licence & contributing

Licensed under **AGPL-3.0** (see [`LICENSE`](./LICENSE)). Contributions are welcome under the Developer Certificate of Origin and the clean-room anti-copy policy — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
