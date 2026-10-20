"""Home initialization must not seed a SOUL.md.

Ciel's persona lives in code (``ciel/persona.py``), which is what an empty home gets. An
auto-seeded SOUL.md would shadow it with a shorter copy, so the seed is a no-op and any existing
SOUL.md — symlink, custom file or none — is left exactly as the operator wired it.
"""

import pytest

from ciel_cli.config import _ensure_default_soul_md
from ciel_cli.config_home import initialize_home

_SUBDIRS = ("cron", "sessions", "logs", "memories")


@pytest.mark.parametrize("target", ["SOUL.md", "missing-dir/SOUL.md"], ids=["cyclic", "dangling"])
def test_initialize_home_leaves_unwritable_soul_symlink_alone(tmp_path, target):
    home = tmp_path / ".ciel"
    home.mkdir()
    soul = home / "SOUL.md"
    soul.symlink_to(home / target)

    initialize_home(home, _SUBDIRS, set())

    assert soul.is_symlink()
    assert not [p for p in home.iterdir() if p.name.startswith(".SOUL.md.")]


def test_no_soul_md_is_created(tmp_path):
    home = tmp_path / ".ciel"
    home.mkdir()

    _ensure_default_soul_md(home)
    initialize_home(home, _SUBDIRS, set())

    assert not (home / "SOUL.md").exists()


def test_soul_symlink_to_customized_file_is_left_alone(tmp_path):
    home = tmp_path / ".ciel"
    home.mkdir()
    target = tmp_path / "shared-identity.md"
    target.write_text("custom identity\n", encoding="utf-8")
    soul = home / "SOUL.md"
    soul.symlink_to(target)

    _ensure_default_soul_md(home)
    initialize_home(home, _SUBDIRS, set())

    assert soul.is_symlink()
    assert soul.read_text(encoding="utf-8") == "custom identity\n"
