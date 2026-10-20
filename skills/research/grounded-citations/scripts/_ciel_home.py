"""Resolve CIEL_HOME for standalone skill scripts.

Skill scripts may run outside the Ciel process (system Python, nix env,
CI) where ``ciel_constants`` is not importable.  This module provides the
same ``get_ciel_home()`` contract without requiring it on ``sys.path``.

When ``ciel_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from ciel_constants import get_ciel_home
except (ModuleNotFoundError, ImportError):

    def get_ciel_home() -> Path:
        """Return the Ciel home directory (default: ``~/.ciel``)."""
        val = os.environ.get("CIEL_HOME", "").strip()
        return Path(val) if val else Path.home() / ".ciel"
