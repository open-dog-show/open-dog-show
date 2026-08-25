# SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
# SPDX-License-Identifier: AGPL-3.0-only
"""
Aggregates the respond-pr-review skill's usage log (JSONL on the `skill-perf`
branch) into a human-readable Markdown dashboard committed to main.

Used by the `.github/workflows/skill-perf-dashboard.yml` workflow and runnable
by hand.  Reads the log via `gh api` (raw media type).  Aggregate counts only;
no per-PR comment bodies are stored or shown.

Usage:
    python scripts/aggregate-skill-perf.py --source-repo OWNER/REPO \
        --branch skill-perf --path .github/skill-perf/usage.jsonl \
        --out docs/skill-perf/respond-pr-review.md
"""
import argparse
import json
import os
import subprocess
import sys
from collections import Counter


def fetch_log(source_repo, path, branch):
    r = subprocess.run(
        ["gh", "api", f"repos/{source_repo}/contents/{path}?ref={branch}",
         "-H", "Accept: application/vnd.github.raw+json"],
        capture_output=True, encoding="utf-8",
    )
    if r.returncode != 0:
        return []
    return [json.loads(ln) for ln in r.stdout.splitlines() if ln.strip()]


def aggregate(records):
    action_totals = Counter()
    thread_totals = Counter()
    failure_cats = Counter()
    ratios = []
    failures_runs = 0
    for r in records:
        action_totals.update(r.get("actions", {}))
        thread_totals.update(r.get("threads", {}))
        fs = r.get("failures", []) or []
        if fs:
            failures_runs += 1
            failure_cats.update(fs)
        m = r.get("metrics", {})
        if "token_ratio" in m:
            ratios.append(m["token_ratio"])
    approved = action_totals.get("implemented", 0)
    proposed = action_totals.get("proposed", 0) + action_totals.get("reproposed", 0)
    return {
        "runs": len(records),
        "last_ts": records[-1]["ts"] if records else "-",
        "action_totals": dict(action_totals),
        "thread_totals": dict(thread_totals),
        "failures_runs": failures_runs,
        "failure_cats": dict(failure_cats),
        "approval_rate": (approved / proposed) if proposed else 0,
        "avg_ratio": (sum(ratios) / len(ratios)) if ratios else None,
        "ratios_n": len(ratios),
    }


def render(stats):
    lines = [
        "# respond-pr-review \u2014 performance dashboard",
        "",
        f"_Auto-generated from `usage.jsonl` on the `skill-perf` branch. "
        f"Last run: {stats['last_ts']}_",
        "",
        "## Summary",
        "",
        f"- **Runs recorded:** {stats['runs']}",
        f"- **Runs with \u22651 failure:** {stats['failures_runs']}",
        f"- **Approval rate:** {stats['approval_rate']:.0%} "
        f"({stats['action_totals'].get('implemented',0)} implemented / "
        f"{stats['action_totals'].get('proposed',0)+stats['action_totals'].get('reproposed',0)} proposed)",
        f"- **Mean token ratio (terse/full):** "
        + (f"{stats['avg_ratio']:.2f} over {stats['ratios_n']} runs" if stats['avg_ratio'] is not None else "n/a"),
        "",
        "## Action totals",
        "",
    ]
    for k in ["proposed", "reproposed", "implemented", "resolved", "skipped"]:
        lines.append(f"- {k}: {stats['action_totals'].get(k, 0)}")
    lines += ["", "## Thread states seen", ""]
    for k in ["New", "Awaiting", "Approved", "Pushback"]:
        lines.append(f"- {k}: {stats['thread_totals'].get(k, 0)}")
    lines += ["", "## Failure categories", ""]
    if stats["failure_cats"]:
        for k, v in sorted(stats["failure_cats"].items(), key=lambda x: -x[1]):
            lines.append(f"- {k}: {v}")
    else:
        lines.append("- _none_")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Aggregate skill-perf usage into a dashboard.")
    ap.add_argument("--source-repo", required=True, help="OWNER/REPO holding the perf log.")
    ap.add_argument("--branch", default="skill-perf")
    ap.add_argument("--path", default=".github/skill-perf/usage.jsonl")
    ap.add_argument("--out", help="Output file (default: stdout).")
    args = ap.parse_args()

    records = fetch_log(args.source_repo, args.path, args.branch)
    md = render(aggregate(records))
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8", newline="\n") as f:
            f.write(md)
        print(f"dashboard written to {args.out}")
    else:
        sys.stdout.write(md)


if __name__ == "__main__":
    main()