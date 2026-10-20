"""A host that mirrors the served profile into CIEL_HOME must not flip launch-home identity.

Ciel WebUI serves several profiles from one process and, for legacy readers, mirrors the active
turn's profile into ``os.environ["CIEL_HOME"]`` while also installing the context-local override.
Every "is this task routed / is this the launch home" decision that compared the override with the
live env var then saw the served home as the launch home: MCP connections were keyed by bare name
(shared across profiles), the launch residue was never stripped from the served profile's child env,
the launch profile's bridged allow-all grant was seeded into the served profile's secret scope, and
the served profile's ``terminal.*`` config was bridged into the shared process env.
``ciel_constants.pin_process_ciel_home`` gives such hosts one stable anchor for all of them.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import ciel_constants
from agent.secret_scope import _is_process_home, serves_routed_profile
from ciel_cli.env_loader import _process_ciel_home
from tools.environments.local import _is_routed_home
from tools.mcp_tool_scope import _server_key


def _under(home, fn):
    """Run *fn* with *home* installed as the task's Ciel-home override."""
    token = ciel_constants.set_ciel_home_override(home)
    try:
        return fn()
    finally:
        ciel_constants.reset_ciel_home_override(token)


# name -> "does this decision treat *home* as a routed (non-launch) profile?"
ROUTED = {
    "secret_scope.serves_routed_profile": lambda home: _under(home, serves_routed_profile),
    "secret_scope._is_process_home": lambda home: not _is_process_home(home),
    "environments.local._is_routed_home": lambda home: _is_routed_home(home),
    "env_loader._process_ciel_home": lambda home: _process_ciel_home().resolve() != Path(home).resolve(),
    "mcp_tool_scope._server_key": lambda home: _under(home, lambda: _server_key("atlassian")) != "atlassian",
}


@pytest.fixture
def homes(tmp_path, monkeypatch):
    launch = tmp_path / "launch"
    served = tmp_path / "profiles" / "served"
    launch.mkdir()
    served.mkdir(parents=True)
    monkeypatch.setenv("CIEL_HOME", str(launch))
    monkeypatch.setattr(ciel_constants, "_PINNED_PROCESS_CIEL_HOME", None)
    return launch, served


@pytest.mark.parametrize("decision", sorted(ROUTED))
def test_pinned_launch_home_survives_a_mirrored_ciel_home(homes, monkeypatch, decision):
    launch, served = homes
    routed = ROUTED[decision]
    ciel_constants.pin_process_ciel_home(launch)
    monkeypatch.setenv("CIEL_HOME", str(served))  # the host's per-turn mirror

    assert routed(served) is True
    assert routed(launch) is False
    # The served profile's MCP connection is its own, keyed by its home, not a bare shared name.
    assert _under(served, lambda: _server_key("atlassian")) == (ciel_constants.ciel_home_key(served), "atlassian")
    # Process-asset readers keep following the env var: only routing decisions use the pin.
    assert ciel_constants.get_process_ciel_home() == served
    assert ciel_constants.get_routing_process_ciel_home() == launch


@pytest.mark.parametrize("decision", sorted(ROUTED))
def test_unpinned_or_cleared_pin_keeps_ciel_home_semantics(homes, monkeypatch, decision):
    launch, served = homes
    routed = ROUTED[decision]
    for _ in ("never pinned", "pinned then cleared"):
        monkeypatch.setenv("CIEL_HOME", str(launch))
        assert routed(served) is True
        assert routed(launch) is False
        monkeypatch.setenv("CIEL_HOME", str(served))  # mirrored: the env var IS the launch home
        assert routed(served) is False
        ciel_constants.pin_process_ciel_home(launch)
        ciel_constants.pin_process_ciel_home(None)
