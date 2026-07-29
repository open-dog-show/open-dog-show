# Contributing

Thanks for helping build an open, community-owned dog-show platform.

## Licensing

This project is licensed under the **GNU Affero General Public License v3.0** (see [`LICENSE`](./LICENSE)). By contributing, you agree that your contributions are licensed under AGPL-3.0. Because it is a network-copyleft licence, anyone who runs a modified version as a network service must make their source available — this keeps the platform open for the clubs and community that depend on it.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/) instead of a CLA. Every commit must be signed off:

```
git commit -s
```

This adds a `Signed-off-by: Your Name <you@example.com>` line, by which you certify the DCO — that you wrote the contribution or otherwise have the right to submit it under the project's licence.

## Anti-copy / clean-room policy

This project is a **clean-room** implementation. It is derived from **real kennel-club regulations** (FCI, SRSH/KMSH, and other national bodies) and original work — **never** from any competitor's product.

By signing off your commits you also certify that your contribution:

- does **not** copy text, screenshots, page layouts, database contents, wording, or other **expression** from any competitor's product;
- is your original work, or is derived from **public primary sources** (official kennel-club regulations, standards, and public specifications) that you cite;
- does not import proprietary or non-AGPL-compatible material.

Ideas, features, and facts are not copyrightable — modelling the same real-world domain is fine — but a competitor's *expression* is protected. When in doubt, describe capability in your own words and cite the primary regulation, not a competitor's page.

## Domain model first

Before changing behaviour, consult [`CONTEXT.md`](./CONTEXT.md) (ubiquitous language), [`CONTEXT-MAP.md`](./CONTEXT-MAP.md) (bounded contexts), [`docs/domain-invariants.md`](./docs/domain-invariants.md), and the ADRs in [`docs/adr/`](./docs/adr/). Keep the domain core free of framework/infrastructure concerns.
