"""Deterministic rule engine: reconciles AI-extracted observations against a reference netlist.

Safety invariants (each has a regression test):
  * A wrong or ambiguous reading never yields PASS.
  * Conflicting duplicate observations of one wire -> REVIEW, regardless of order (no last-write-wins).
  * Wire ends are undirected (A->B == B->A).  Sizes compare numerically; colours compare exactly.
  * A missing / unreadable value is REVIEW (null + flag), never silently accepted and never guessed.
  * Partial page coverage, an uncertified specification or an empty extraction can never PASS.
  * A machine PASS only means 'no discrepancy found'; a human reviewer still signs off.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Sequence, Tuple

from .wirecodes import colour_is_valid, norm_colour, norm_size, norm_terminal, norm_wire_no

PASS, FAIL, REVIEW = "PASS", "FAIL", "REVIEW"


@dataclass
class Observation:
    wire_no: Optional[str]
    colour: Optional[str] = None
    size: Optional[str] = None
    source: Optional[str] = None
    destination: Optional[str] = None
    confidence: float = 1.0
    evidence: str = ""
    page: int = 1


@dataclass
class Expected:
    wire_no: str
    colour: Optional[str] = None
    size: Optional[str] = None
    source: Optional[str] = None
    destination: Optional[str] = None


def _sig(o: Observation) -> tuple:
    ends = tuple(sorted((norm_terminal(o.source), norm_terminal(o.destination))))
    return (ends, norm_colour(o.colour), norm_size(o.size))


def _finding(rule_id, name, outcome, title, reason, expected="", detected="", evidence="", page=None):
    return {
        "finding_id": f"FND-{uuid.uuid4().hex[:6].upper()}",
        "rule_id": rule_id,
        "rule_name": name,
        "standard_reference": "SPANQC Tech Pub validation (LMS)",
        "severity": "CRITICAL" if outcome == FAIL else "WARNING",
        "outcome": outcome,
        "title": title,
        "reason": reason,
        "expected_value": expected,
        "detected_value": detected,
        "evidence_text": evidence,
        "page_number": page,
        "human_review_required": outcome != PASS,
    }


def _fmt(o: Observation) -> str:
    return f"{o.source}->{o.destination} [{o.colour}, {o.size} mm2] (p{o.page})"


def evaluate(
    observations: Sequence[Observation],
    expected: Sequence[Expected],
    *,
    specification_is_complete: bool = False,
    total_pages: int = 1,
    processed_pages: int = 1,
    failed_pages: Sequence[int] = (),
    min_confidence: float = 0.6,
) -> Tuple[str, List[dict]]:
    findings: List[dict] = []

    exp_by_wire: Dict[str, Expected] = {}
    for e in expected:
        key = norm_wire_no(e.wire_no)
        if not key:
            raise ValueError("Expected wire without a wire_no")
        if key in exp_by_wire:
            raise ValueError(f"Duplicate wire '{key}' in the reference specification")
        exp_by_wire[key] = e

    groups: Dict[str, List[Observation]] = {}
    for o in observations:
        key = norm_wire_no(o.wire_no)
        if key:
            groups.setdefault(key, []).append(o)
        else:
            findings.append(_finding("LMS-09", "Unidentified Observation", REVIEW,
                                     "Observation without a wire number",
                                     "An extracted item has no readable wire number and cannot be matched.",
                                     detected=_fmt(o), evidence=o.evidence, page=o.page))

    coverage_gap = bool(failed_pages) or processed_pages < total_pages
    if coverage_gap:
        findings.append(_finding("LMS-10", "Incomplete Page Coverage", REVIEW,
                                 "Not every page was processed",
                                 f"{processed_pages}/{total_pages} pages processed; failed pages: {list(failed_pages)}. "
                                 "A partial read can never pass."))

    if not observations and exp_by_wire:
        findings.append(_finding("LMS-12", "Empty Extraction", REVIEW, "No observations were extracted",
                                 "The extraction returned nothing; this is treated as an extraction failure, not as missing wires."))
    else:
        for key, e in exp_by_wire.items():
            group = groups.get(key)
            if not group:
                findings.append(_finding("LMS-01", "Missing Wire", FAIL, f"Wire '{e.wire_no}' not found in the drawing",
                                         f"Reference wire '{e.wire_no}' has no matching observation.",
                                         expected=f"{e.wire_no}: {e.source}->{e.destination} [{e.colour}, {e.size} mm2]"))
                continue
            if len({_sig(o) for o in group}) > 1:
                findings.append(_finding("LMS-02", "Conflicting Duplicate Observations", REVIEW,
                                         f"Wire '{e.wire_no}' read {len(group)} times with conflicting values",
                                         "The readings disagree on ends, colour or size; a human must decide which is correct.",
                                         expected=f"{e.wire_no}: {e.source}->{e.destination} [{e.colour}, {e.size} mm2]",
                                         detected=" | ".join(_fmt(o) for o in group),
                                         evidence=group[0].evidence, page=group[0].page))
                continue
            o = max(group, key=lambda x: x.confidence)

            if o.confidence < min_confidence:
                findings.append(_finding("LMS-07", "Low Confidence Reading", REVIEW,
                                         f"Wire '{e.wire_no}' read with low confidence ({o.confidence:.2f})",
                                         f"Confidence is below the {min_confidence:.2f} threshold; a human must confirm.",
                                         detected=_fmt(o), evidence=o.evidence, page=o.page))
                continue

            # colour
            if e.colour is not None:
                oc = norm_colour(o.colour)
                if oc is None:
                    findings.append(_finding("LMS-09", "Unreadable Attribute", REVIEW, f"Wire '{e.wire_no}': colour not read",
                                             "Colour was not extracted (null); not guessed.", expected=e.colour,
                                             evidence=o.evidence, page=o.page))
                elif not colour_is_valid(oc):
                    findings.append(_finding("LMS-06", "Invalid Colour Code", REVIEW, f"Wire '{e.wire_no}': unrecognised colour '{o.colour}'",
                                             "Not a known colour code; possible misread.", expected=e.colour, detected=str(o.colour),
                                             evidence=o.evidence, page=o.page))
                elif oc != norm_colour(e.colour):
                    findings.append(_finding("LMS-04", "Colour Mismatch", FAIL, f"Wire '{e.wire_no}': colour differs from reference",
                                             f"Reference colour {e.colour}, drawing shows {oc}.", expected=e.colour, detected=oc,
                                             evidence=o.evidence, page=o.page))
            # size (numeric)
            if e.size is not None:
                osz, esz = norm_size(o.size), norm_size(e.size)
                if osz is None:
                    findings.append(_finding("LMS-09", "Unreadable Attribute", REVIEW, f"Wire '{e.wire_no}': size not read",
                                             "Size was not extracted (null) or is not a number; not guessed.", expected=str(e.size),
                                             detected=str(o.size), evidence=o.evidence, page=o.page))
                elif osz != esz:
                    findings.append(_finding("LMS-05", "Size Mismatch", FAIL, f"Wire '{e.wire_no}': size differs from reference",
                                             f"Reference {esz} mm2, drawing shows {osz} mm2.", expected=esz, detected=osz,
                                             evidence=o.evidence, page=o.page))
            # ends (undirected)
            if e.source is not None or e.destination is not None:
                want = tuple(sorted((norm_terminal(e.source), norm_terminal(e.destination))))
                got = tuple(sorted((norm_terminal(o.source), norm_terminal(o.destination))))
                if "" in got and "" not in want:
                    findings.append(_finding("LMS-09", "Unreadable Attribute", REVIEW, f"Wire '{e.wire_no}': an endpoint was not read",
                                             "An endpoint is null; not guessed.", expected=f"{e.source}<->{e.destination}",
                                             detected=f"{o.source}<->{o.destination}", evidence=o.evidence, page=o.page))
                elif want != got:
                    findings.append(_finding("LMS-03", "Endpoint Mismatch", FAIL, f"Wire '{e.wire_no}': endpoints differ from reference",
                                             "The terminals at the two ends do not match the reference.",
                                             expected=f"{e.source}<->{e.destination}", detected=f"{o.source}<->{o.destination}",
                                             evidence=o.evidence, page=o.page))

        for key, group in groups.items():
            if key not in exp_by_wire:
                findings.append(_finding("LMS-08", "Unlisted Wire", REVIEW, f"Wire '{key}' is in the drawing but not in the reference",
                                         "May be an addition, or the specification is incomplete.", detected=_fmt(group[0]),
                                         evidence=group[0].evidence, page=group[0].page))

    if any(f["outcome"] == FAIL for f in findings):
        overall = FAIL
    elif findings or not specification_is_complete or coverage_gap:
        overall = REVIEW
    else:
        overall = PASS
    return overall, findings
