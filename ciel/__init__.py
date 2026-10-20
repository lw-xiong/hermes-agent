"""Ciel-specific layer over the Hermes harness.

Everything here is additive: upstream files gain at most a one-line import, so `ciel-sync`
rebases cleanly. Persona first; later tiers (memory, prompt assembly, permissions) land here
too rather than in upstream modules.
"""

from ciel.persona import CIEL_BODY_GUIDANCE, CIEL_IDENTITY

__all__ = ["CIEL_IDENTITY", "CIEL_BODY_GUIDANCE"]
