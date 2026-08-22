# GitHub Copilot workspace instructions

> **The coding standards are canonically maintained in
> [`AGENTS.md`](../AGENTS.md#coding-standards).** Read and follow that file
> before doing any work — it covers the project, SPDX headers, file naming,
> TypeScript rules, architecture (ADR-0004 / ADR-0006), package management, and
> commit signing.

GitHub Copilot auto-loads `.github/copilot-instructions.md`. This file is a thin
pointer kept so Copilot, Cline (`.clinerules/`), and any other agent all follow
the single source of truth in `AGENTS.md` and never drift apart.

> **Note for `/ddd-review`:** the architectural-constraints source (each
> package's declared role) now lives in `AGENTS.md` → `Coding standards` →
> `Architecture`. Follow this pointer instead of expecting the role table in
> this file.
