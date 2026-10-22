"""Font-size verification (LMS standard), done deterministically from the SVG text sizes. No AI involved.

Standards (px), from the LMS:  KL label 8 | component code 10 | connector / plug / socket code 7 | colour (wire) label 7
Checked here: only categories identifiable from the text alone.
NOT checked (and said so, never guessed):
  * pin numbers and grid/reference notation: they look identical to other digits, so they need position data
  * 'options' category: the LMS says its standard is still unconfirmed
Candidate violations still need a human look: a regex can mis-categorise text (e.g. 'CAN' is a bus label, not a component).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional

from .svg_truth import svg_texts
from .wirecodes import WireLabel

STANDARDS_PX: Dict[str, float] = {"KL label": 8.0, "component code": 10.0, "connector code": 7.0, "colour/wire label": 7.0}

# Known non-component tokens that match the component pattern. Extend as they are found.
NOT_COMPONENTS = frozenset({"CAN"})

_CATEGORIES: Dict[str, Callable[[str], bool]] = {
    "KL label": lambda t: bool(re.fullmatch(r"KL\d+[A-Z]?", t)),
    "component code": lambda t: bool(re.fullmatch(r"C[A-Z]{1,3}\d{0,3}[a-z]?", t)) and t not in NOT_COMPONENTS,
    "connector code": lambda t: bool(re.fullmatch(r"(CN|CK|CA|CB|CS)-\d+[A-Za-z]?", t)),
    "colour/wire label": lambda t: WireLabel.parse(t) is not None,
}


@dataclass(frozen=True)
class FontViolation:
    category: str
    text: str
    found_px: Optional[float]
    expected_px: float


def check_fonts(svg_path: str | Path, standards: Dict[str, float] = STANDARDS_PX) -> List[FontViolation]:
    out: List[FontViolation] = []
    for item in svg_texts(svg_path):
        for cat, is_cat in _CATEGORIES.items():
            if cat in standards and is_cat(item.text):
                if item.font_px != standards[cat]:
                    out.append(FontViolation(cat, item.text, item.font_px, standards[cat]))
                break
    return out
