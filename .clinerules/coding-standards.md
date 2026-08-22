# Cline rules — coding standards

> **The coding standards are canonically maintained in
> [`AGENTS.md`](../AGENTS.md#coding-standards).** Read and follow that file
> before doing any work — it covers the project, SPDX headers, file naming,
> TypeScript rules, architecture (ADR-0004 / ADR-0006), package management, and
> commit signing.

Cline auto-loads `.clinerules/`. This file is a thin pointer kept so Cline,
GitHub Copilot (`.github/copilot-instructions.md`), and any other agent all
follow the single source of truth in `AGENTS.md` and never drift apart.
