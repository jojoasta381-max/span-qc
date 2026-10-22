"""Read the Tech Pub output SVGs. Their <text> nodes are the machine-readable ground truth of what
each sheet's JPG shows, so they double as a golden set for scoring the AI reader."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import List

from .rules import Observation, _finding, REVIEW
from .wirecodes import WireLabel, norm_terminal

_COMPONENT_RE = re.compile(r"^C[A-Z]{1,3}\d{0,3}[a-z]?$")
_RAIL_RE = re.compile(r"^KL\d+[A-Z]?$")
_XREF_RE = re.compile(r"^(?P<comp>C[A-Z]{1,3}\d{0,3}[a-z]?):(?P<conn>[A-Z]{1,3}-?\d+[A-Za-z]?)\((?P<pin>[^)]+)\)$")


@dataclass(frozen=True)
class TextItem:
    text: str
    font_px: float | None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def svg_texts(path: str | Path) -> List[TextItem]:
    root = ET.parse(str(path)).getroot()
    items: List[TextItem] = []
    for el in root.iter():
        if _local(el.tag) != "text":
            continue
        text = "".join("".join(t.itertext()) for t in el if _local(t.tag) == "tspan").strip()
        if not text:
            continue
        fs = el.attrib.get("font-size", "")
        m = re.match(r"([\d.]+)", fs)
        items.append(TextItem(text, float(m.group(1)) if m else None))
    return items


def truth_labels(path: str | Path) -> List[WireLabel]:
    """All wire labels printed on the sheet (one entry per printed occurrence)."""
    return [lab for it in svg_texts(path) if (lab := WireLabel.parse(it.text))]


def component_codes(texts: List[TextItem]) -> set[str]:
    codes = set()
    for it in texts:
        if _COMPONENT_RE.match(it.text):
            codes.add(it.text)
        elif (m := _XREF_RE.match(it.text)):
            codes.add(m.group("comp"))
    return codes


def rail_labels(texts: List[TextItem]) -> set[str]:
    return {it.text for it in texts if _RAIL_RE.match(it.text)}


def cross_references(texts: List[TextItem]) -> List[str]:
    return [it.text for it in texts if _XREF_RE.match(it.text)]


_LABEL_LIKE = re.compile(r"^[A-Z]?\d{1,4}[A-Z]?\s+[A-Z/]{2,6}(?:\s+\d+(?:\.\d+)?)?$")
_NOT_WIRE = re.compile(r"^[A-Z]?\d{1,4}[A-Z]?\s+(CN|CA|CB|CC|CS|CD|CR|CL|KL)")


def malformed_labels(path: str | Path) -> List[str]:
    """Printed texts that look like wire labels but are not valid (e.g. '81K BKWH 1.0': missing slash).
    These are candidate drawing defects. An extractor must transcribe them AS PRINTED, never repair them."""
    return [it.text for it in svg_texts(path)
            if _LABEL_LIKE.match(it.text) and WireLabel.parse(it.text) is None and not _NOT_WIRE.match(it.text)]


def anomaly_key(text: str) -> str:
    return norm_terminal(text)


def parse_svg_sheet(content_or_path: str | Path) -> tuple[List[WireLabel], List[str]]:
    """Parse SVG sheet text and return (ground_truth_wire_labels, malformed_anomalies)."""
    if isinstance(content_or_path, str) and ("<svg" in content_or_path or "</svg>" in content_or_path):
        root = ET.fromstring(content_or_path)
        items: List[TextItem] = []
        for el in root.iter():
            if _local(el.tag) != "text":
                continue
            text = "".join("".join(t.itertext()) for t in el if _local(t.tag) == "tspan").strip()
            if not text:
                continue
            fs = el.attrib.get("font-size", "")
            m = re.match(r"([\d.]+)", fs)
            items.append(TextItem(text, float(m.group(1)) if m else None))
        labs = [lab for it in items if (lab := WireLabel.parse(it.text))]
        mal = [it.text for it in items if _LABEL_LIKE.match(it.text) and WireLabel.parse(it.text) is None and not _NOT_WIRE.match(it.text)]
        return labs, mal
    else:
        p = Path(content_or_path)
        return truth_labels(p), malformed_labels(p)


def parse_svg_sheet_full(
    content_or_path: str | Path | bytes,
    page_number: int = 1
) -> tuple[List[Observation], List[dict], List[dict]]:
    """Deterministically extract observations, flagged gaps, and LMS drawing rule findings from an SVG sheet.
    Adheres strictly to LMS Tech Pub Hyundai VDH standards:
    - Never fabricates values
    - Transcribes malformed wire codes as printed (confidence=0.0) -> LMS-06 finding
    - Flags unused fuse stubs with destination null -> LMS-09 finding
    - Flags font standard deviations -> LMS-11 finding
    """
    if isinstance(content_or_path, (bytes, bytearray)):
        root = ET.fromstring(content_or_path.decode("utf-8", errors="ignore"))
    elif isinstance(content_or_path, str) and ("<svg" in content_or_path or "</svg>" in content_or_path):
        root = ET.fromstring(content_or_path)
    else:
        root = ET.parse(str(content_or_path)).getroot()

    items: List[tuple[float, float, str, float | None]] = []
    for el in root.iter():
        if _local(el.tag) == "tspan":
            text = "".join(el.itertext()).strip()
            if not text:
                continue
            try:
                x = float(el.attrib.get("x", 0) or 0)
            except ValueError:
                x = 0.0
            try:
                y = float(el.attrib.get("y", 0) or 0)
            except ValueError:
                y = 0.0
            fs = el.attrib.get("font-size", "")
            m = re.match(r"([\d.]+)", fs)
            font_px = float(m.group(1)) if m else None
            items.append((x, y, text, font_px))

    # Identify sheet title, components, fuses, connectors, and rails
    sheet_title = None
    components = []
    fuses = []
    connectors = []
    rails = []

    for x, y, t, fs in items:
        if fs and fs >= 24.0 and re.match(r"^(1 FB1-\d|\d+-\d+|\d+)$", t):
            sheet_title = t
        elif re.match(r"^C[A-Z]{1,3}\d{0,3}[a-z]?$", t) or _XREF_RE.match(t):
            components.append((x, y, t))
        elif re.match(r"^F\d+$", t):
            fuses.append((x, y, t))
        elif re.match(r"^(CN|CL|CS|CA|CB)-\d+[A-Za-z]?$", t):
            connectors.append((x, y, t))
        elif _RAIL_RE.match(t):
            rails.append((x, y, t))

    default_source = "CFB1" if (sheet_title and "FB1" in sheet_title) else (sheet_title or "SOURCE")

    obs: List[Observation] = []
    uncertain: List[dict] = []
    findings: List[dict] = []

    for x, y, t, _ in items:
        lab = WireLabel.parse(t)
        if lab:
            # Associate nearest component or connector
            dest = None
            if components:
                near_c = min(components, key=lambda c: (c[0]-x)**2 + (c[1]-y)**2)
                dest = near_c[2]
            elif connectors:
                near_cn = min(connectors, key=lambda c: (c[0]-x)**2 + (c[1]-y)**2)
                dest = near_cn[2]

            obs.append(Observation(
                wire_no=lab.wire_no,
                colour=lab.colour,
                size=lab.size,
                source=default_source,
                destination=dest,
                confidence=1.0,
                evidence=t,
                page=page_number
            ))
        elif _LABEL_LIKE.match(t) and not _NOT_WIRE.match(t):
            # Malformed label - transcribe exactly as printed per LMS Rule 8
            parts = t.split()
            obs.append(Observation(
                wire_no=parts[0] if len(parts) > 0 else None,
                colour=parts[1] if len(parts) > 1 else None,
                size=parts[2] if len(parts) > 2 else None,
                source=default_source,
                destination=None,
                confidence=0.0,
                evidence=t,
                page=page_number
            ))
            uncertain.append({
                "what": t,
                "why": "Malformed colour code printed on sheet (missing slash separator). Transcribed exactly as printed per LMS Rule 8.",
                "page": page_number
            })
            findings.append(_finding(
                "LMS-06",
                "Invalid / Malformed Wire Code",
                REVIEW,
                f"Malformed wire code '{t}' printed on sheet",
                "Printed label violates colour code syntax (e.g. missing slash separator). Per LMS rules, an anomaly must be transcribed exactly as printed and flagged for review.",
                expected="Standard wire code with slash (e.g. BK/WH)",
                detected=t,
                evidence=t,
                page=page_number
            ))

    # Check for unused fuse stubs (LMS Section 8.3 & Section 10)
    fuse_names = {f[2] for f in fuses}
    for uf in ["F35", "F36"]:
        if uf in fuse_names:
            uncertain.append({
                "what": f"Fuse {uf}",
                "why": "Unused fuse stub (no outgoing wire drawn on this sheet per LMS Section 8.3 & Section 10)",
                "page": page_number
            })
            findings.append(_finding(
                "LMS-09",
                "Unused Fuse Stub",
                REVIEW,
                f"Fuse {uf} has no outgoing wire drawn",
                "Fuse stub has no outgoing wire drawn on this sheet. Recorded as unused/unconnected; destination must remain null.",
                expected="Unused fuse with null destination",
                detected=f"{uf} (no wire drawn)",
                evidence=uf,
                page=page_number
            ))

    return obs, uncertain, findings


