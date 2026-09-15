#!/usr/bin/env python3
"""diff-skills-trees.py

Compare three Skill tree roots and report drift:

    .agents/skills/   <-- canonical source of truth
    .claude/skills/   <-- mirror (expected to be a symlink farm)
    .codex/skills/    <-- mirror (expected to be a symlink farm)

For each Skill name, this script:

  1. Walks every file under the canonical Skill directory.
  2. Hashes each file (sha256, content only) keyed by the file's path
     relative to the Skill root.
  3. Repeats the walk for the two mirrors, following symlinks so that a
     correctly-linked Skill reports as identical instead of as drift.
  4. Classifies each Skill as one of:

       IDENTICAL        - all three trees agree on every file's content
       CANONICAL_DIVERGES - .agents/ is the truth; both mirrors agree with
                            each other but disagree with .agents/  (rare;
                            usually means someone edited the mirror)
       ALL_DIVERGE      - each of the three trees has at least one unique
                            hash (needs a human to decide which is truth)
       MISSING          - present in one tree but not the others
       LINKING_FAULT    - a mirror is a real directory (or wrong symlink)
                            even though its contents match (still flagged
                            so the repo can be converted to a symlink farm)

It also reports a `link_status` summary so a maintainer can see at a glance
how many Skills are proper symlinks vs. accidental copies.

Usage:

    python3 scripts/diff-skills-trees.py                # human report
    python3 scripts/diff-skills-trees.py --check        # CI mode: exit 1
                                                      # on any drift
    python3 scripts/diff-skills-trees.py --json        # machine report

The script never modifies the tree. It only reads.

Exit codes:

    0  every Skill is IDENTICAL and the link farm is intact
    1  drift, missing files, or linking faults were detected
    2  usage / argument error
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


CANONICAL = Path(".agents/skills")
MIRRORS = (Path(".claude/skills"), Path(".codex/skills"))


# ---------------------------------------------------------------------------
# IO helpers


def _hash_file(path: Path) -> str:
    """Return the sha256 hex digest of a file's contents."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _walk_hashes(root: Path, *, follow_symlinks: bool) -> dict[str, str]:
    """Walk *root* and return {relative_path: sha256} for every regular file.

    Symlinks are followed when *follow_symlinks* is True so a mirror that
    is a proper symlink farm reports as identical to the canonical tree.
    Directory symlinks (the Skill roots themselves) are also followed.
    """
    if not root.exists():
        return {}
    hashes: dict[str, str] = {}
    for dirpath, dirnames, filenames in os.walk(
        root, followlinks=follow_symlinks
    ):
        for filename in filenames:
            # Skip obvious non-content bookkeeping; keep dotfiles though,
            # because some Skills ship .clawhub/ etc.
            filepath = Path(dirpath) / filename
            if filepath.is_symlink() and not follow_symlinks:
                continue
            try:
                rel = filepath.relative_to(root)
            except ValueError:
                # Shouldn't happen with os.walk, but stay defensive.
                continue
            hashes[str(rel)] = _hash_file(filepath)
    return hashes


def _link_status(skill_root: Path) -> str:
    """Describe how *skill_root* is connected to the canonical tree.

    Returns one of: LINKED, BROKEN_LINK, WRONG_TARGET, REAL_DIR.
    """
    if not skill_root.exists():
        return "MISSING"
    if skill_root.is_symlink():
        target = os.readlink(skill_root)
        resolved = (skill_root.parent / target).resolve()
        if not resolved.exists():
            return "BROKEN_LINK"
        expected = (CANONICAL / skill_root.name).resolve()
        if resolved == expected:
            return "LINKED"
        return "WRONG_TARGET"
    return "REAL_DIR"


# ---------------------------------------------------------------------------
# Reporting model


@dataclass
class SkillReport:
    name: str
    status: str  # IDENTICAL | CANONICAL_DIVERGES | ALL_DIVERGE | MISSING | LINKING_FAULT
    canonical_hashes: dict[str, str] = field(default_factory=dict)
    claude_hashes: dict[str, str] = field(default_factory=dict)
    codex_hashes: dict[str, str] = field(default_factory=dict)
    claude_link: str = ""
    codex_link: str = ""
    detail: list[str] = field(default_factory=list)


def _compare_skill(name: str) -> SkillReport:
    canon_root = CANONICAL / name
    claude_root = MIRRORS[0] / name
    codex_root = MIRRORS[1] / name

    rep = SkillReport(
        name=name,
        status="MISSING",
        claude_link=_link_status(claude_root),
        codex_link=_link_status(codex_root),
    )

    # Presence check across the three trees.
    present_in = [p for p in (canon_root, claude_root, codex_root) if p.exists()]
    if not present_in:
        rep.status = "MISSING"
        rep.detail.append("not present in any tree")
        return rep
    if len(present_in) < 3:
        rep.status = "MISSING"
        missing = []
        if not canon_root.exists():
            missing.append(".agents")
        if not claude_root.exists():
            missing.append(".claude")
        if not codex_root.exists():
            missing.append(".codex")
        rep.detail.append(f"missing in: {', '.join(missing)}")
        return rep

    rep.canonical_hashes = _walk_hashes(canon_root, follow_symlinks=False)
    rep.claude_hashes = _walk_hashes(claude_root, follow_symlinks=True)
    rep.codex_hashes = _walk_hashes(codex_root, follow_symlinks=True)

    canon_set = set(rep.canonical_hashes)
    claude_set = set(rep.claude_hashes)
    codex_set = set(rep.codex_hashes)

    # File-set differences always count as drift, even when the contents
    # of the overlapping files happen to match.
    if canon_set != claude_set or canon_set != codex_set:
        only_canon = canon_set - claude_set - codex_set
        only_claude = claude_set - canon_set - codex_set
        only_codex = codex_set - canon_set - claude_set
        parts = []
        if only_canon:
            parts.append(f"only-in-.agents: {sorted(only_canon)}")
        if only_claude:
            parts.append(f"only-in-.claude: {sorted(only_claude)}")
        if only_codex:
            parts.append(f"only-in-.codex: {sorted(only_codex)}")
        rep.detail.extend(parts)
        rep.status = "ALL_DIVERGE"
        return rep

    # Same file set; compare content hashes.
    content_mismatch: list[str] = []
    for rel in sorted(canon_set):
        c = rep.canonical_hashes[rel]
        l = rep.claude_hashes[rel]
        x = rep.codex_hashes[rel]
        if c == l == x:
            continue
        if c != l and l == x:
            # Mirrors agree with each other but not with canonical.
            content_mismatch.append(f"{rel}: .agents differs (.claude == .codex)")
        else:
            content_mismatch.append(f"{rel}: all three differ")

    if not content_mismatch:
        # Content matches but the linkage may still be a fault (real dir).
        if rep.claude_link == "REAL_DIR" or rep.codex_link == "REAL_DIR":
            rep.status = "LINKING_FAULT"
            fault = []
            if rep.claude_link == "REAL_DIR":
                fault.append(".claude is a real directory; expected symlink")
            if rep.codex_link == "REAL_DIR":
                fault.append(".codex is a real directory; expected symlink")
            rep.detail.extend(fault)
        else:
            rep.status = "IDENTICAL"
    elif all(".claude == .codex" in line for line in content_mismatch):
        rep.status = "CANONICAL_DIVERGES"
        rep.detail.extend(content_mismatch)
    else:
        rep.status = "ALL_DIVERGE"
        rep.detail.extend(content_mismatch)

    return rep


# ---------------------------------------------------------------------------
# Reporting


def _print_human(reports: list[SkillReport]) -> int:
    by_status: dict[str, list[SkillReport]] = {}
    for r in reports:
        by_status.setdefault(r.status, []).append(r)

    order = ["IDENTICAL", "CANONICAL_DIVERGES", "ALL_DIVERGE", "MISSING", "LINKING_FAULT"]
    total = len(reports)
    print(f"Skills scanned: {total}")
    for status in order:
        items = by_status.get(status, [])
        if not items:
            continue
        print(f"\n  [{status}] x{len(items)}")
        for r in sorted(items, key=lambda x: x.name):
            line = f"    - {r.name}"
            if r.claude_link or r.codex_link:
                line += f"   (claude={r.claude_link or '-'}; codex={r.codex_link or '-'})"
            print(line)
            for d in r.detail:
                print(f"        {d}")

    # Link-farm summary.
    real_dirs = sum(
        1 for r in reports if r.claude_link == "REAL_DIR" or r.codex_link == "REAL_DIR"
    )
    linked = sum(
        1
        for r in reports
        if r.claude_link == "LINKED" and r.codex_link == "LINKED"
    )
    print("\n  Link-farm summary")
    print(f"    fully linked:   {linked}")
    print(f"    real-directory: {real_dirs}")
    print(f"    other:          {total - linked - real_dirs}")

    drift_total = total - len(by_status.get("IDENTICAL", []))
    return 1 if drift_total else 0


def _print_json(reports: Iterable[SkillReport]) -> int:
    payload = {
        "canonical": str(CANONICAL),
        "mirrors": [str(m) for m in MIRRORS],
        "skills": [
            {
                "name": r.name,
                "status": r.status,
                "claude_link": r.claude_link,
                "codex_link": r.codex_link,
                "detail": r.detail,
                "canonical_files": sorted(r.canonical_hashes),
            }
            for r in reports
        ],
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    drift = sum(1 for r in reports if r.status != "IDENTICAL")
    return 1 if drift else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if any drift, missing files, or linking faults are found",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit a machine-readable JSON report instead of the human summary",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="repository root (default: current directory)",
    )
    args = parser.parse_args(argv)

    global CANONICAL, MIRRORS
    root = Path(args.root).resolve()
    CANONICAL = root / ".agents/skills"
    MIRRORS = (root / ".claude/skills", root / ".codex/skills")

    if not CANONICAL.is_dir():
        print(f"ERROR: canonical tree missing: {CANONICAL}", file=sys.stderr)
        return 2

    names = sorted({p.name for p in CANONICAL.iterdir() if p.is_dir() or p.is_symlink()})
    if not names:
        print(f"ERROR: no Skills found under {CANONICAL}", file=sys.stderr)
        return 2

    reports = [_compare_skill(n) for n in names]

    if args.json:
        rc = _print_json(reports)
    else:
        rc = _print_human(reports)

    if args.check:
        return rc
    return rc if args.json else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))