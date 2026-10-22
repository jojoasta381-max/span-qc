"""Golden-set scoring for prompt iterations. Fabricated entries are the metric that must stay at zero."""
from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List

from .wirecodes import WireLabel, norm_colour, norm_size, norm_terminal, norm_wire_no


@dataclass
class SheetScore:
    sheet: str
    truth: int
    observed: int
    matched: int
    fabricated: List[str]
    missed: List[str]

    @property
    def precision(self) -> float:
        return self.matched / self.observed if self.observed else 1.0

    @property
    def recall(self) -> float:
        return self.matched / self.truth if self.truth else 1.0


def _label(item) -> WireLabel | None:
    if isinstance(item, WireLabel):
        return item
    if isinstance(item, str):
        return WireLabel.parse(item)
    col = norm_colour(item.get("colour"))
    return WireLabel(norm_wire_no(item.get("wire_no")), col, norm_size(item.get("size"))) if col else None


def score_sheet(sheet: str, truth: Iterable[WireLabel], observed: Iterable, anomalies: Iterable[str] = ()) -> SheetScore:
    """anomalies: label-like texts that are printed on the sheet but invalid (candidate drawing defects).
    Transcribing one exactly as printed is CORRECT; 'repairing' it (e.g. adding the missing slash) counts as fabrication."""
    t, o = Counter(truth), Counter()
    anomaly_left = Counter(norm_terminal(a) for a in anomalies)
    anomaly_total = sum(anomaly_left.values())
    faithful = unparsable = 0
    for item in observed:
        lab = _label(item)
        if lab is None and isinstance(item, str) and anomaly_left[norm_terminal(item)] > 0:
            anomaly_left[norm_terminal(item)] -= 1
            faithful += 1
        elif lab is None:
            unparsable += 1
        else:
            o[lab] += 1
    t_total = sum(t.values()) + anomaly_total
    matched = sum(min(t[k], o[k]) for k in o) + faithful
    fabricated = [f"{k.text} x{o[k] - t[k]}" for k in o if o[k] > t[k]]
    missed = [f"{k.text} x{t[k] - o[k]}" for k in t if t[k] > o[k]]
    fabricated += [f"<unparsable item> x{unparsable}"] if unparsable else []
    missed += [f"<anomaly as printed> x{n}" for n in anomaly_left.values() if n > 0]
    return SheetScore(sheet, t_total, sum(o.values()) + unparsable + faithful, matched, sorted(fabricated), sorted(missed))


def aggregate(scores: List[SheetScore]) -> dict:
    truth, obs, matched = (sum(getattr(s, k) for s in scores) for k in ("truth", "observed", "matched"))
    return {
        "sheets": len(scores), "truth_labels": truth, "observed_labels": obs, "matched": matched,
        "precision": round(matched / obs, 4) if obs else 1.0,
        "recall": round(matched / truth, 4) if truth else 1.0,
        "fabricated_count": sum(len(s.fabricated) for s in scores),
    }


def write_run_log(path: str | Path, *, prompt_version: str, model: str, change_note: str, scores: List[SheetScore]) -> dict:
    """Append one prompt-iteration record (one change per version, scored against the same golden set)."""
    record = {
        "when": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "prompt_version": prompt_version, "model": model, "change_note": change_note,
        "aggregate": aggregate(scores),
        "per_sheet": [{**asdict(s), "precision": round(s.precision, 4), "recall": round(s.recall, 4)} for s in scores],
    }
    p = Path(path)
    log = json.loads(p.read_text()) if p.exists() else []
    log.append(record)
    p.write_text(json.dumps(log, indent=2))
    return record
