# SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
# SPDX-License-Identifier: AGPL-3.0-only
"""Install or update the respond-pr-review skill under .github/skills/ and .cline/skills/.

The skill lives in its own repo (open-dog-show/respond-pr-review) and is consumed
locally here, under the gitignored .github/skills/ and .cline/skills/ directories — skills are treated
as per-developer tooling, not tracked files. This script pins the version so every
contributor runs the same skill, WITHOUT a git submodule (no submodule-init
friction on fresh clones, and no .gitignore surgery).

Usage:
    python scripts/install-respond-pr-review.py   # install or update to VERSION
    pnpm skill:install                             # same, via pnpm

Bump VERSION below to adopt a new release, then re-run.
"""
import os
import subprocess
import sys

REPO = "https://github.com/open-dog-show/respond-pr-review"
VERSION = "v0.1.0"
TARGETS = [
    os.path.join(".github", "skills", "respond-pr-review"),
    os.path.join(".cline", "skills", "respond-pr-review"),
]


def run(cmd):
    return subprocess.run(cmd, capture_output=True, encoding="utf-8")


def fail(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def install_or_update(path):
    if os.path.isdir(os.path.join(path, ".git")):
        dirty = run(["git", "-C", path, "status", "--porcelain"])
        if dirty.stdout.strip():
            fail(f"{path} has local modifications; commit, stash, or remove them, then re-run.")
        r = run(["git", "-C", path, "fetch", "--tags", "--depth", "1", "origin"])
        if r.returncode != 0:
            fail(r.stderr)
        r = run(["git", "-C", path, "checkout", VERSION])
        if r.returncode != 0:
            fail(r.stderr)
        print(f"updated {path} to {VERSION}")
    else:
        if os.path.exists(path):
            fail(f"{path} already exists but is not a recognized skill clone; move or remove it manually before re-running.")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        r = run(["git", "clone", "--depth", "1", "--branch", VERSION, REPO, path])
        if r.returncode != 0:
            fail(r.stderr)
        print(f"installed {path} at {VERSION}")


def main():
    for path in TARGETS:
        install_or_update(path)


if __name__ == "__main__":
    main()