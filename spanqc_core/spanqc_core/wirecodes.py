"""Wire-label parsing and normalisation for the Tech Pub drawing conventions.

Label forms seen on the real sheets (wire no and size are each optional; the colour is always present):
    '122A WH/RD 1.5'  full         'WH 2.0'  continuation (no wire no)
    '4 RD'            no size      'G18 BK 0.75'  letter-prefixed wire no
Colour codes are two-letter, optionally slash-combined (primary/stripe).  Order matters: WH/RD != RD/WH.
Sizes are cross-section in mm2.  They are compared NUMERICALLY ('2' == '2.0'), never as substrings.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional

# Derived from the 31 reference sheets (not invented). Extend via configuration when new codes appear.
BASE_COLOURS = frozenset({"BK", "WH", "RD", "GN", "BU", "YE", "OG", "BN", "GY", "VT", "PK"})

_LABEL_RE = re.compile(
    r"^\s*(?:(?P<no>[A-Z]?\d{1,4}[A-Z]?)\s+)?(?P<col>[A-Z]{2}(?:/[A-Z]{2})?)(?:\s+(?P<size>\d+(?:\.\d+)?))?\s*$"
)
_SIZE_UNIT_RE = re.compile(r"(?i)\s*mm\s*[²2]?\s*$")


def norm_colour(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = re.sub(r"\s+", "", str(value)).upper()
    return v or None


def colour_is_valid(code: Optional[str]) -> bool:
    if not code:
        return False
    parts = code.split("/")
    return 1 <= len(parts) <= 2 and all(p in BASE_COLOURS for p in parts)


def norm_size(value) -> Optional[str]:
    """Canonical mm2 string ('2.0' -> '2', '0.750' -> '0.75'); None if not a positive number."""
    if value is None:
        return None
    text = _SIZE_UNIT_RE.sub("", str(value).strip()) if isinstance(value, str) else str(value)
    try:
        d = Decimal(text.strip())
    except (InvalidOperation, ValueError):
        return None
    if not d.is_finite() or d <= 0:
        return None
    return format(d.normalize(), "f")


def norm_terminal(value: Optional[str]) -> str:
    """Case- and whitespace-insensitive terminal / component reference key."""
    return re.sub(r"\s+", "", value or "").upper()


def norm_wire_no(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = re.sub(r"\s+", "", str(value)).upper()
    return v or None


@dataclass(frozen=True)
class WireLabel:
    wire_no: Optional[str]
    colour: str
    size: Optional[str]  # canonical mm2 string

    @property
    def text(self) -> str:
        return " ".join(p for p in (self.wire_no, self.colour, self.size) if p)

    @classmethod
    def parse(cls, text: str) -> Optional["WireLabel"]:
        m = _LABEL_RE.match(text or "")
        if not m:
            return None
        if not colour_is_valid(m.group("col")):
            return None  # unknown code: not accepted as ground truth (the extractor path flags it as LMS-06)
        if m.group("no") is None and m.group("size") is None:
            return None  # a bare colour token is not a wire label
        return cls(m.group("no"), m.group("col"), norm_size(m.group("size")))
