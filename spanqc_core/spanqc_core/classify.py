"""Destination classification (LMS 'Module CAC' traceability standard).

green  = confirmed final destination component within scope
yellow = named component, but the cross-sheet boundary was not re-verified
grey   = genuinely unresolved (missing, unknown component, or unreadable)
blue   = rail continuity note (KL30 / KL31 ...), not a component endpoint

Verification goes straight to the FINAL destination component code and pin; no intermediate stops.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from .wirecodes import norm_terminal

_PAREN_SUFFIX = re.compile(r"\s*\([^)]*\)\s*$")
_RAIL = re.compile(r"^KL\d+[A-Z]?$", re.I)


class DestClass(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    GREY = "grey"
    BLUE = "blue"


@dataclass
class ComponentIndex:
    """in_scope: components verified within the module under check. known: every component in the
    component list. A placeholder built from sheet text is used until the HX Codes sheet is loaded."""
    in_scope: set[str] = field(default_factory=set)
    known: set[str] = field(default_factory=set)

    def __post_init__(self):
        self.in_scope = {norm_terminal(c) for c in self.in_scope}
        self.known = {norm_terminal(c) for c in self.known} | self.in_scope


def strip_parenthetical(ref: str) -> str:
    """'CECM:CN-93(4)' -> 'CECM:CN-93'. Must happen BEFORE any lookup."""
    return _PAREN_SUFFIX.sub("", ref or "").strip()


def component_of(ref: str) -> str:
    base = strip_parenthetical(ref)
    return norm_terminal(base.split(":", 1)[0])


def classify_destination(dest: Optional[str], index: ComponentIndex) -> DestClass:
    if dest is None or not dest.strip() or dest.strip() in {"?", "-", "N/A"}:
        return DestClass.GREY
    if _RAIL.match(strip_parenthetical(dest)):
        return DestClass.BLUE
    comp = component_of(dest)
    if comp in index.in_scope:
        return DestClass.GREEN
    if comp in index.known:
        return DestClass.YELLOW
    return DestClass.GREY
