from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


def test_platform_modules_only_import_stdlib_and_ciel_platform() -> None:
    root = Path(__file__).resolve().parents[2]
    code = """
import sys
before = set(sys.modules)
import ciel_platform.host.facts
import ciel_platform.host.gpu_adapters
import ciel_platform.host.runtime
import ciel_platform.host.products
import ciel_platform.host.summary
import ciel_platform.declaration
import ciel_platform.resolver
import ciel_platform.resolver.app
import ciel_platform.resolver.availability
import ciel_platform.resolver.known_dirs
new_top_levels = {name.partition('.')[0] for name in set(sys.modules) - before}
unexpected = sorted(
    name
    for name in new_top_levels
    if name not in sys.stdlib_module_names and not name.startswith('ciel_platform')
)
assert not unexpected, unexpected
"""
    env = os.environ.copy()
    env["PYTHONPATH"] = "."

    subprocess.run(
        [sys.executable, "-c", code],
        cwd=root,
        env=env,
        check=True,
    )
