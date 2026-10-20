"""Re-apply the Ciel rename to a hermes-agent tree.

Upstream ships `hermes` names; this fork says Ciel everywhere. Run after every
rebase so new upstream files come back into the same shape:

    python3 scripts/cielify.py            # apply
    python3 scripts/cielify.py --check    # report only, exit 1 if anything to do

Rules (ordered): module/package names, then HERMES_* env vars, then ~/.hermes
paths, then prose, then file and directory names. Upstream URLs and the git
remotes are protected: they must keep pointing at NousResearch.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", ".ciel",
             ".mypy_cache", ".pytest_cache", ".ruff_cache", "htmlcov", "site-packages"}
SKIP_FILES = {"uv.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock",
              "FORK.md", "cielify.py"}
TEXT_EXT = {".py", ".md", ".yaml", ".yml", ".toml", ".json", ".txt", ".sh", ".fish", ".ts",
            ".tsx", ".js", ".jsx", ".css", ".html", ".jinja", ".j2", ".cfg", ".ini", ".service",
            ".spec", ".cff", ".rst", ".bat", ".ps1", ".mjs", ".cjs", ".env", ".example"}

# Substrings that must survive untouched (they identify the real upstream repo).
PROTECT = [
    "NousResearch/hermes-agent",
    "lw-xiong/hermes-agent",
    "hermes-agent.nousresearch.com",
    "nousresearch/hermes-agent",
]

# Directory / file renames, longest token first so hermes_cli wins over hermes.
TOKEN_RENAMES = [
    ("hermes_cli", "ciel_cli"),
    ("hermes_bootstrap", "ciel_bootstrap"),
    ("hermes_constants_scratch", "ciel_constants_scratch"),
    ("hermes_constants", "ciel_constants"),
    ("hermes_logging", "ciel_logging"),
    ("hermes_startup_watchdog", "ciel_startup_watchdog"),
    ("hermes_state_common", "ciel_state_common"),
    ("hermes_state_compression", "ciel_state_compression"),
    ("hermes_state_coverage", "ciel_state_coverage"),
    ("hermes_state_dbfile", "ciel_state_dbfile"),
    ("hermes_state_errors", "ciel_state_errors"),
    ("hermes_state_fts", "ciel_state_fts"),
    ("hermes_state_gateway", "ciel_state_gateway"),
    ("hermes_state_guard", "ciel_state_guard"),
    ("hermes_state_health", "ciel_state_health"),
    ("hermes_state_holders", "ciel_state_holders"),
    ("hermes_state_identity", "ciel_state_identity"),
    ("hermes_state_ids", "ciel_state_ids"),
    ("hermes_state_lockguard", "ciel_state_lockguard"),
    ("hermes_state", "ciel_state"),
    ("hermes_tools_mcp_server", "ciel_tools_mcp_server"),
    ("hermes_yaml", "ciel_yaml"),
    ("hermes_paths", "ciel_paths"),
    ("hermes_home", "ciel_home"),
]

PROSE = [
    ("HERMES", "CIEL"),
    ("Hermes Agent", "Ciel"),
    ("Hermes Web UI", "Ciel Web UI"),
    ("hermes-agent", "ciel-agent"),
    ("Hermes", "Ciel"),
    ("hermes", "ciel"),
]


def iter_files(root: Path):
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES:
                continue
            p = Path(base) / f
            if p.suffix.lower() in TEXT_EXT or f in {"hermes", "ciel"}:
                yield p


def transform(text: str) -> str:
    saved: dict[str, str] = {}
    for i, token in enumerate(PROTECT):
        pattern = re.compile(re.escape(token), re.IGNORECASE)

        def keep(m: re.Match[str], i: int = i) -> str:
            key = f"\x00{i}_{len(saved)}\x00"
            saved[key] = m.group(0)
            return key

        text = pattern.sub(keep, text)
    for old, new in TOKEN_RENAMES:
        text = text.replace(old, new)
    text = text.replace("HERMES_", "CIEL_")
    text = re.sub(r"(?<![\w.])\.hermes(?![\w])", ".ciel", text)
    for old, new in PROSE:
        text = text.replace(old, new)
    for key, original in saved.items():
        text = text.replace(key, original)
    return text


def rename_paths(root: Path, dry: bool) -> list[tuple[str, str]]:
    moves = []
    paths = [p for p in root.rglob("*") if not any(part in SKIP_DIRS for part in p.parts)]
    for p in sorted(paths, key=lambda q: len(q.parts), reverse=True):
        if p.name in SKIP_FILES:
            continue
        new_name = p.name.replace("HERMES_", "CIEL_").replace("hermes_agent", "ciel_agent")
        new_name = re.sub(r"hermes", "ciel", new_name)
        if new_name != p.name:
            moves.append((str(p), str(p.with_name(new_name))))
    if not dry:
        for src, dst in moves:
            if Path(dst).exists():
                continue
            subprocess.run(["git", "mv", src, dst], cwd=root, check=False)
    return moves


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    root = Path(args.root).resolve()

    changed = []
    for p in iter_files(root):
        try:
            t = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        n = transform(t)
        if n != t:
            changed.append(str(p.relative_to(root)))
            if not args.check:
                p.write_text(n, encoding="utf-8")

    moves = rename_paths(root, dry=args.check)

    print(f"content files: {len(changed)}  path renames: {len(moves)}")
    for c in changed[:10]:
        print("  M", c)
    for src, dst in moves[:10]:
        print("  R", src, "->", dst)
    if args.check and (changed or moves):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
