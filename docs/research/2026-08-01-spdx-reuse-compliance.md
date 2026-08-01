# SPDX & FSFE REUSE Compliance for an AGPL-3.0-only pnpm Monorepo

*Research date: 2026-08-01 | Sources: SPDX 2.3 spec, REUSE Specification 3.3*

---

## 1. SPDX File-Level Tags

[SPDX Spec 2.3 Annex H](https://spdx.github.io/spdx-spec/v2.3/file-tags/) defines two in-file tags, each on a single comment line near the top of the file:

```ts
// SPDX-FileCopyrightText: 2026 Example Corp <contact@example.com>
//
// SPDX-License-Identifier: AGPL-3.0-only
```

Format: `SPDX-tagname: <value>` terminated by a newline. Multiple `SPDX-FileCopyrightText` lines are valid; each must be on its own line. Multi-line values are explicitly discouraged by the spec.

---

## 2. Correct SPDX Identifier for AGPL-3.0

Use **`AGPL-3.0-only`**. GNU-family licenses (GPL, LGPL, AGPL, GFDL) must always carry either `-only` or `-or-later`; the bare `AGPL-3.0` identifier is deprecated and non-conformant.

- [`AGPL-3.0-only`](https://spdx.org/licenses/AGPL-3.0-only.html) — version 3 only.
- `AGPL-3.0-or-later` — version 3 or any later FSF-published version.

Source: [spdx.dev/learn/handling-license-info/#gnu-licenses](https://spdx.dev/learn/handling-license-info/#gnu-licenses); [spdx.org/licenses/AGPL-3.0-only.html](https://spdx.org/licenses/AGPL-3.0-only.html).

---

## 3. FSFE REUSE Spec v3.3 — What It Adds on Top of Bare SPDX Headers

[REUSE Specification 3.3](https://reuse.software/spec-3.3/) (published 2024-11-14) requires three things beyond inline SPDX tags:

1. **`LICENSES/` directory in the repo root** — one plain-text file per license, named `<SPDX-ID>.txt` (e.g. `LICENSES/AGPL-3.0-only.txt`). Every license referenced by any covered file must have a corresponding file; the directory must not contain anything else.
2. **Every covered file** must have both a copyright notice and an `SPDX-License-Identifier`. Covered files = all files except those in `LICENSES/`, `.reuse/`, VCS-ignored files, and zero-byte files.
3. **Uncommentable files** must be covered by an adjacent `.license` file or by a `REUSE.toml` / `.reuse/dep5` entry (see §4 and §8).

Source: [reuse.software/spec-3.3/#license-files](https://reuse.software/spec-3.3/#license-files); [reuse.software/spec-3.3/#covered-and-ignored-files](https://reuse.software/spec-3.3/#covered-and-ignored-files).

---

## 4. Files That Cannot Carry Inline Headers

JSON files, lock files (`pnpm-lock.yaml`), and binary assets cannot contain comments. Two conformant approaches:

**Option A — adjacent `.license` file** (per-file, explicit):
```
pnpm-lock.yaml.license      ← contains the two SPDX lines
```

**Option B — `REUSE.toml`** (preferred for whole directories):
```toml
version = 1

[[annotations]]
path = ["**/*.json", "pnpm-lock.yaml", "**/*.png"]
precedence = "override"
SPDX-FileCopyrightText = "2026 Example Corp"
SPDX-License-Identifier = "AGPL-3.0-only"
```

Source: [reuse.software/spec-3.3/#comment-headers](https://reuse.software/spec-3.3/#comment-headers); [reuse.software/spec-3.3/#reuse-toml](https://reuse.software/spec-3.3/#reuse-toml).

---

## 5. The `reuse` CLI Tool and CI Integration

**Install** (Python 3.10+ required):
```sh
pipx install reuse                      # isolated install (recommended)
reuse download AGPL-3.0-only           # fetch license text → LICENSES/
reuse lint                             # exits non-zero on any violation
```

**GitHub Actions** — add `.github/workflows/reuse.yml`:
```yaml
name: REUSE compliance check
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: fsfe/reuse-action@v6
```

Sources: [reuse.readthedocs.io — Install](https://reuse.readthedocs.io/en/stable/readme.html#install); [reuse.software/dev/#github-actions](https://reuse.software/dev/#inclusion-in-cicd-workflows).

---

## 6. Year Semantics for `SPDX-FileCopyrightText`

The REUSE spec says the notice SHOULD include the **year of publication** (first release/creation). Modification years are not required. A year may be a single value, a comma-separated list, or a range:

```
SPDX-FileCopyrightText: 2026 Example Corp
SPDX-FileCopyrightText: 2016, 2018-2019 Jane Doe <jane@example.com>
```

Source: [reuse.software/spec-3.3/#format-of-copyright-notices](https://reuse.software/spec-3.3/#format-of-copyright-notices).

---

## 7. `SPDX-FileCopyrightText` vs Traditional `Copyright (C)`

The REUSE spec states: *"It is RECOMMENDED to use the `SPDX-FileCopyrightText` tag."* Plain `Copyright`, `©`, and `(C)` are also accepted but not preferred. The reason: `SPDX-FileCopyrightText` is machine-readable and allows automated SPDX bill-of-materials generation via `reuse spdx`.

Source: [reuse.software/spec-3.3/#format-of-copyright-notices](https://reuse.software/spec-3.3/#format-of-copyright-notices).

---

## 8. `REUSE.toml` vs `.reuse/dep5` Tradeoffs

| | `REUSE.toml` | `.reuse/dep5` |
|---|---|---|
| **Status** | Current | **Deprecated** in REUSE 3.x |
| **Location** | Any directory in the project | Only `.reuse/dep5` |
| **Format** | TOML | Debian DEP5 |
| **Glob support** | Yes (`*`, `**`) | Limited |
| **Migration** | — | `reuse convert-dep5` |

The spec is explicit: *"DEP5 is deprecated … you SHOULD create a `REUSE.toml` file instead."* For a new pnpm monorepo, use a root-level `REUSE.toml` for generated and comment-hostile files; put per-package overrides in per-package `REUSE.toml` files as needed.

Source: [reuse.software/spec-3.3/#dep5-deprecated](https://reuse.software/spec-3.3/#dep5-deprecated); [reuse.software/spec-3.3/#reuse-toml](https://reuse.software/spec-3.3/#reuse-toml).
