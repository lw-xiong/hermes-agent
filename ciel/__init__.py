"""Ciel-specific layer over the Ciel harness.

Everything here is additive: upstream files gain at most a one-line import, so `ciel-sync`
rebases cleanly. Persona first; later tiers (memory, prompt assembly, permissions) land here
too rather than in upstream modules.
"""

from ciel.persona import CIEL_BODY_GUIDANCE, CIEL_IDENTITY

# Ciel's own version. Hermes is the engine underneath, so its base version is shown beside ours
# rather than replacing it.
__version__ = "0.1.0"

__all__ = ["CIEL_IDENTITY", "CIEL_BODY_GUIDANCE", "__version__"]
