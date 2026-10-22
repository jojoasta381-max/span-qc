"""Claude extraction layer. The model only TRANSCRIBES; every judgement is made by deterministic rules.

Fail-closed behaviour:
  * truncated output (stop_reason == max_tokens) -> page marked failed, nothing trusted
  * unparsable JSON                                -> page marked failed
  * an item whose evidence_text does not support its fields -> kept, but confidence forced to 0 (-> REVIEW)
  * nothing is ever filled in, corrected, or guessed here
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Protocol

from .rules import Observation
from .wirecodes import norm_colour, norm_size, norm_wire_no

PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"
DEFAULT_MODEL = os.environ.get("SPANQC_MODEL", "claude-sonnet-4-6")


@dataclass
class ModelReply:
    text: str
    stop_reason: str


class ExtractionClient(Protocol):
    model: str

    def create(self, *, system: str, image: bytes, media_type: str, max_tokens: int) -> ModelReply: ...


class AnthropicClient:
    """Thin HTTP client. The API key lives server-side only (env), never in the browser."""

    def __init__(self, api_key: Optional[str] = None, model: str = DEFAULT_MODEL, timeout: float = 120.0, retries: int = 2):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured on the server.")
        self.model, self.timeout, self.retries = model, timeout, retries

    def create(self, *, system: str, image: bytes, media_type: str, max_tokens: int) -> ModelReply:
        import httpx

        body = {
            "model": self.model, "max_tokens": max_tokens, "system": system,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type,
                                             "data": base64.b64encode(image).decode()}},
                {"type": "text", "text": "Transcribe this sheet per the instructions."}]}],
        }
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID")  # required only for keys not scoped to a workspace
        if workspace:
            headers["anthropic-workspace-id"] = workspace
        last = None
        for attempt in range(self.retries + 1):
            r = httpx.post("https://api.anthropic.com/v1/messages", json=body, headers=headers, timeout=self.timeout)
            if r.status_code in (429, 500, 502, 503, 529) and attempt < self.retries:
                time.sleep(2 ** attempt)
                last = r
                continue
            if r.status_code >= 400:  # surface the API's own reason; never hide it behind a bare status code
                try:
                    detail = r.json().get("error", {}).get("message", r.text[:300])
                except ValueError:
                    detail = r.text[:300]
                raise RuntimeError(f"Anthropic API {r.status_code}: {detail}")
            data = r.json()
            text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
            return ModelReply(text, data.get("stop_reason", ""))
        raise RuntimeError(f"Model call failed: {last.status_code if last else 'unknown'}")


def load_prompt(version: str = "extract_v1") -> tuple[str, str]:
    text = (PROMPT_DIR / f"{version}.md").read_text(encoding="utf-8")
    return version, text


@dataclass
class SheetExtraction:
    ok: bool
    prompt_version: str
    observations: List[Observation] = field(default_factory=list)
    uncertain: List[dict] = field(default_factory=list)
    sheet_name: Optional[str] = None
    error: Optional[str] = None
    truncated: bool = False


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)
_NUM = re.compile(r"\d+(?:\.\d+)?")


def _evidence_supports(item: dict) -> bool:
    ev = re.sub(r"\s+", "", str(item.get("evidence_text") or "")).upper()
    no, colour = norm_wire_no(item.get("wire_no")), norm_colour(item.get("colour"))
    if not ev or not no or no not in ev:
        return False
    if colour and colour not in ev:
        return False
    size = norm_size(item.get("size_mm2"))
    if size is not None and size not in {norm_size(n) for n in _NUM.findall(str(item.get("evidence_text")))}:
        return False
    return True


def parse_reply(reply: ModelReply, prompt_version: str, page: int = 1) -> SheetExtraction:
    if reply.stop_reason == "max_tokens":
        return SheetExtraction(False, prompt_version, error="Model output was truncated (max_tokens). Nothing trusted.", truncated=True)
    try:
        data = json.loads(_FENCE.sub("", reply.text.strip()))
        if not isinstance(data, dict) or not isinstance(data.get("wires"), list):
            raise ValueError("missing 'wires' array")
    except (ValueError, json.JSONDecodeError) as exc:
        return SheetExtraction(False, prompt_version, error=f"Unparsable model output: {exc}")

    uncertain = [u for u in data.get("uncertain", []) if isinstance(u, dict)]
    obs: List[Observation] = []
    for raw in data["wires"]:
        if not isinstance(raw, dict):
            uncertain.append({"what": "non-object wire entry", "why": repr(raw)[:80]})
            continue
        try:
            conf = float(raw.get("confidence", 0.0))
        except (TypeError, ValueError):
            conf = 0.0
        conf = max(0.0, min(1.0, conf))
        if not _evidence_supports(raw):
            conf = 0.0  # evidence does not back the fields -> forced to human review
        obs.append(Observation(
            wire_no=raw.get("wire_no"), colour=raw.get("colour"),
            size=None if raw.get("size_mm2") is None else str(raw.get("size_mm2")),
            source=raw.get("source"), destination=raw.get("destination"),
            confidence=conf, evidence=str(raw.get("evidence_text") or ""), page=page))
    return SheetExtraction(True, prompt_version, obs, uncertain, data.get("sheet_name"))


def extract_sheet(client: ExtractionClient, image: bytes, media_type: str, *, page: int = 1,
                  prompt_version: str = "extract_v1", max_tokens: int = 8192) -> SheetExtraction:
    version, system = load_prompt(prompt_version)
    try:
        reply = client.create(system=system, image=image, media_type=media_type, max_tokens=max_tokens)
    except Exception as exc:  # network / auth / rate limit: the page fails, the run never fakes data
        return SheetExtraction(False, version, error=f"Model call failed: {exc}")
    return parse_reply(reply, version, page)
