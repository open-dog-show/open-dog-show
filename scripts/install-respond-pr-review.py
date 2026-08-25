# SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
# SPDX-License-Identifier: AGPL-3.0-only
"""Install or update the respond-pr-review skill into .github/skills/respond-pr-review.

The skill lives in its own repo (open-dog-show/respond-pr-review) and is consumed
locally here, under the gitignored .github/skills/ directory — skills are treated
as per-developer tooling, not tracked files. This script pins the version so every
contributor runs the same skill, WITHOUT a git submodule (no submodule-init
friction on fresh clones, and no .gitignore surgery).

Usage:
    python scripts/install-respond-pr-review.py   # install or update to VERSION
    pnpm skill:install                             # same, via pnpm

Bump VERSION below to adopt a new release, then re-run.
"""
import os
import shutil
import subprocess
import sys

REPO = "https://github.com/open-dog-show/respond-pr-review"
VERSION = "v0.1.0"
PATH = os.path.join(".github", "skills", "respond-pr-review")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, encoding="utf-8")


def fail(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def main():
    if os.path.isdir(os.path.join(PATH, ".git")):
        r = run(["git", "-C", PATH, "fetch", "--tags", "--depth", "1", "origin"])
        if r.returncode != 0:
            fail(r.stderr)
        r = run(["git", "-C", PATH, "checkout", VERSION])
        if r.returncode != 0:
            fail(r.stderr)
        print(f"updated {PATH} to {VERSION}")
    else:
        if os.path.exists(PATH):
            shutil.rmtree(PATH, ignore_errors=True)
        os.makedirs(os.path.dirname(PATH), exist_ok=True)
        r = run(["git", "clone", "--depth", "1", "--branch", VERSION, REPO, PATH])
        if r.returncode != 0:
            fail(r.stderr)
        print(f"installed {PATH} at {VERSION}")


if __name__ == "__main__":
    main()