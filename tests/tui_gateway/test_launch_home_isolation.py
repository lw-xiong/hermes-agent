"""The launch home the TUI server binds launch-profile turns to must follow the process home."""
import os
from pathlib import Path

# Imported at collection on purpose: that is when real test modules import the server,
# before any per-test fixture redirects CIEL_HOME, so ``_ciel_home`` freezes to the
# pre-fixture home exactly as it does for the rest of the suite.
from tui_gateway import server
from tui_gateway.launch_profile_policy import launch_secret_scope


def test_launch_home_follows_the_process_home_redirected_after_import():
    """``server._ciel_home`` is get_ciel_home() at import — under a developer shell the
    honored custom CIEL_HOME, a guarded root. Launch-profile turns read ``<launch home>/.env``
    (``launch_secret_scope``), so the home they bind must be resolved at call time from the
    process env, like the launch ``state.db`` handle (#112692), never the import-time value."""
    sandbox = Path(os.environ["CIEL_HOME"])
    assert server._launch_home() == sandbox
    (sandbox / ".env").write_text("CIEL_LAUNCH_HOME_PROBE=from-sandbox\n", encoding="utf-8")
    assert launch_secret_scope(server._launch_home()).get("CIEL_LAUNCH_HOME_PROBE") == "from-sandbox"
