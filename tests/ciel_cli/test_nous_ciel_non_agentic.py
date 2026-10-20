"""Tests for the Nous-Ciel-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"ciel"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``ciel-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "ciel" tag namespace.

``is_nous_ciel_non_agentic`` should only match the actual Nous Research
Ciel-3 / Ciel-4 chat family.
"""

from __future__ import annotations

import pytest

from ciel_cli.model_switch import (
    _CIEL_MODEL_WARNING,
    _check_ciel_model_warning,
    is_nous_ciel_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "NousResearch/Ciel-3-Llama-3.1-70B",
        "NousResearch/Ciel-3-Llama-3.1-405B",
        "ciel-3",
        "Ciel-3",
        "ciel-4",
        "ciel-4-405b",
        "ciel_4_70b",
        "openrouter/ciel3:70b",
        "openrouter/nousresearch/ciel-4-405b",
        "NousResearch/Ciel3",
        "ciel-3.1",
    ],
)
def test_matches_real_nous_ciel_chat_models(model_name: str) -> None:
    assert is_nous_ciel_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Ciel 3/4"
    )
    assert _check_ciel_model_warning(model_name) == _CIEL_MODEL_WARNING


