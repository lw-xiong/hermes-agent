"""Resolve CIEL_HOME for standalone skill scripts.

Skill scripts may run outside the Ciel process (e.g. system Python,
nix env, CI) where ``ciel_constants`` is not importable.  This module
provides the same ``get_ciel_home()`` and ``display_ciel_home()``
contracts as ``ciel_constants`` without requiring it on ``sys.path``.

When ``ciel_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``ciel_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``CIEL_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from ciel_constants import display_ciel_home
    from ciel_constants import get_ciel_home
except (ModuleNotFoundError, ImportError):

    def get_ciel_home() -> Path:
        """Return the Ciel home directory (default: ~/.ciel).

        Mirrors ``ciel_constants.get_ciel_home()``."""
        val = os.environ.get("CIEL_HOME", "").strip()
        return Path(val) if val else Path.home() / ".ciel"

    def display_ciel_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``ciel_constants.display_ciel_home()``."""
        home = get_ciel_home()
        try:
            return "~/" + home.relative_to(Path.home()).as_posix()
        except ValueError:
            return str(home)
