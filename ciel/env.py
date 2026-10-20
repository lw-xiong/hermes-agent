"""Accept the CIEL_* environment namespace without renaming 771 HERMES_* readers.

Anything the shell sets as CIEL_FOO is mirrored to HERMES_FOO when that is unset, so
`CIEL_HOME`, `CIEL_CONFIG`, `CIEL_MODEL` … work, while config files, MCP definitions, cron
jobs and third-party tools that already speak HERMES_* keep working untouched.
"""

import os


def mirror_env(prefix: str = "CIEL_", target: str = "HERMES_") -> list[str]:
    """Copy ``CIEL_<NAME>`` to ``HERMES_<NAME>`` for every name not already set. Idempotent."""
    mirrored = []
    for key, value in list(os.environ.items()):
        if not key.startswith(prefix):
            continue
        legacy = target + key[len(prefix):]
        if not os.environ.get(legacy):
            os.environ[legacy] = value
            mirrored.append(legacy)
    return mirrored
