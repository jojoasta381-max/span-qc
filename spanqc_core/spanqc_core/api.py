"""FastAPI service. Drop-in for the old Python service: POST /api/v1/analyze (multipart) returns the
report shape the Next.js job-bridge already validates. Fails CLOSED: no key / model error -> page failed
-> never PASS. Nothing is ever simulated."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Callable, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from . import __version__
from .classify import ComponentIndex, classify_destination
from .extract import AnthropicClient, ExtractionClient, extract_sheet
from .fontcheck import check_fonts
from .rules import Expected, Observation, evaluate, FAIL, PASS, REVIEW, _finding
from .svg_truth import malformed_labels
from .wirecodes import WireLabel, norm_colour

MAX_BYTES = 100 * 1024 * 1024
MAX_PAGES = 100


class PageTuple(tuple):
    """2-tuple (img_bytes, mime_type) with optional metadata attributes for zero-breakage backwards compatibility."""
    def __new__(cls, img: bytes, mt: str, name: str = "", svg_raw: Optional[bytes] = None, text_raw: Optional[str] = None):
        return super().__new__(cls, (img, mt))

    def __init__(self, img: bytes, mt: str, name: str = "", svg_raw: Optional[bytes] = None, text_raw: Optional[str] = None):
        self.name = name
        self.svg_raw = svg_raw
        self.text_raw = text_raw


def _pages(data: bytes, filename: str) -> List[PageTuple]:
    head = data[:8]

    # 1. PDF
    if head.startswith(b"%PDF"):
        import pymupdf
        try:
            doc = pymupdf.open(stream=data, filetype="pdf")
            if doc.page_count > MAX_PAGES:
                raise HTTPException(413, f"PDF has {doc.page_count} pages; the limit is {MAX_PAGES}.")
            return [PageTuple(p.get_pixmap(dpi=150).tobytes("png"), "image/png", name=f"Page {idx + 1}", text_raw=p.get_text())
                    for idx, p in enumerate(doc)]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(422, f"PDF document could not be opened: {exc}")

    # 2. PNG
    if head.startswith(b"\x89PNG"):
        return [PageTuple(data, "image/png", name=filename)]

    # 3. JPEG
    if head[:3] == b"\xff\xd8\xff":
        return [PageTuple(data, "image/jpeg", name=filename)]

    # 4. WEBP
    if head.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return [PageTuple(data, "image/webp", name=filename)]

    # 5. ZIP Archive (unzips and reads pdf, png, jpg, jpeg, svg diagrams)
    if head.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")):
        import io
        import zipfile
        import pymupdf

        MAX_UNCOMPRESSED_ZIP_BYTES = 150 * 1024 * 1024
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
        except Exception as exc:
            raise HTTPException(422, f"Corrupted or invalid ZIP archive: {exc}")

        total_uncompressed = 0
        raw_entries = sorted(zf.infolist(), key=lambda x: x.filename.lower())
        valid_entries = []

        for info in raw_entries:
            name = info.filename
            if info.is_dir() or name.startswith("__MACOSX/") or name.startswith(".") or "/." in name:
                continue
            if ".." in name or name.startswith("/") or name.startswith("\\"):
                continue

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_UNCOMPRESSED_ZIP_BYTES:
                raise HTTPException(413, "ZIP uncompressed content exceeds the 150MB limit.")

            lower_name = name.lower()
            # Skip symbol libraries and template definitions (these are reference assets, not drawing sheets)
            if any(k in lower_name for k in ["symbol", "template"]):
                continue

            if lower_name.endswith((".pdf", ".png", ".jpg", ".jpeg", ".svg", ".webp")):
                valid_entries.append(info)

        # Deduplicate sheets by base stem: if both .svg and .jpg/.png exist for the same sheet stem, prioritize .svg
        by_stem = {}
        for info in valid_entries:
            base_name = info.filename.split("/")[-1]
            stem = base_name.rsplit(".", 1)[0].lower()
            ext = base_name.rsplit(".", 1)[-1].lower()
            if stem not in by_stem or ext == "svg":
                by_stem[stem] = info

        sorted_infos = sorted(by_stem.values(), key=lambda x: x.filename.lower())
        extracted_pages: List[PageTuple] = []

        for info in sorted_infos:
            name = info.filename.split("/")[-1]
            lower_name = name.lower()
            entry_data = zf.read(info)

            if lower_name.endswith(".pdf"):
                try:
                    doc = pymupdf.open(stream=entry_data, filetype="pdf")
                    for idx, p in enumerate(doc):
                        extracted_pages.append(PageTuple(p.get_pixmap(dpi=150).tobytes("png"), "image/png", name=f"{name} (p{idx+1})"))
                        if len(extracted_pages) > MAX_PAGES:
                            raise HTTPException(413, f"ZIP contains {len(extracted_pages)}+ pages; limit is {MAX_PAGES}.")
                except HTTPException:
                    raise
                except Exception as exc:
                    raise HTTPException(422, f"Could not read PDF '{name}' inside ZIP: {exc}")
            elif lower_name.endswith(".svg"):
                try:
                    doc = pymupdf.open(stream=entry_data, filetype="svg")
                    extracted_pages.append(PageTuple(doc[0].get_pixmap(dpi=150).tobytes("png"), "image/png", name=name, svg_raw=entry_data))
                except Exception as exc:
                    raise HTTPException(422, f"Could not render SVG '{name}' inside ZIP: {exc}")
            elif lower_name.endswith(".png"):
                extracted_pages.append(PageTuple(entry_data, "image/png", name=name))
            elif lower_name.endswith((".jpg", ".jpeg")):
                extracted_pages.append(PageTuple(entry_data, "image/jpeg", name=name))
            elif lower_name.endswith(".webp"):
                extracted_pages.append(PageTuple(entry_data, "image/webp", name=name))

            if len(extracted_pages) > MAX_PAGES:
                raise HTTPException(413, f"ZIP contains {len(extracted_pages)}+ pages; limit is {MAX_PAGES}.")

        if not extracted_pages:
            raise HTTPException(422, "ZIP archive contains no valid PDF, PNG, JPG, or SVG diagrams.")

        return extracted_pages

    # 6. SVG
    snippet = data[:1024].lstrip().lower()
    if snippet.startswith(b"<svg") or (snippet.startswith(b"<?xml") and b"<svg" in snippet):
        import pymupdf
        try:
            doc = pymupdf.open(stream=data, filetype="svg")
            return [PageTuple(doc[0].get_pixmap(dpi=150).tobytes("png"), "image/png", name=filename, svg_raw=data)]
        except Exception as exc:
            raise HTTPException(422, f"SVG document could not be rendered: {exc}")

    raise HTTPException(415, "Unsupported file type. Upload a ZIP, PDF, PNG, JPG, or SVG.")


def _parse_expected(raw: Optional[str]) -> List[Expected]:
    if not raw:
        return []
    try:
        return [Expected(wire_no=str(w["wire_no"]), colour=w.get("colour"), size=None if w.get("size_mm2") is None else str(w["size_mm2"]),
                         source=w.get("source"), destination=w.get("destination")) for w in json.loads(raw)]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(422, f"expected_netlist_json is invalid: {exc}")


def create_app(client_factory: Optional[Callable[[], ExtractionClient]] = None) -> FastAPI:
    app = FastAPI(title="SPANQC core", version=__version__)
    make_client = client_factory or (lambda: AnthropicClient())

    @app.get("/health")
    def health():
        return {"status": "ok", "version": __version__}

    @app.post("/api/v1/analyze")
    async def analyze(file: UploadFile = File(...), standard: str = Form("SPANQC Tech Pub (Hyundai VDH)"),
                      expected_netlist_json: Optional[str] = Form(None), specification_is_complete: bool = Form(False),
                      extraction_is_verified: bool = Form(False), scope_description: Optional[str] = Form(None),
                      prompt_version: str = Form("extract_v1")):
        data = await file.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "File too large.")
        expected = _parse_expected(expected_netlist_json)
        pages = _pages(data, file.filename or "document")
        has_vector = any(getattr(p, "svg_raw", None) is not None or bool(getattr(p, "text_raw", None) and p.text_raw.strip()) for p in pages)
        client = None
        client_err = None
        try:
            client = make_client()
        except RuntimeError as exc:
            if not has_vector:
                raise HTTPException(503, str(exc))  # fail closed: never fabricate a result
            client_err = str(exc)

        observations: List[Observation] = []
        uncertain: List[dict] = []
        failed: List[int] = []
        errors: List[str] = []
        pages_rendered: List[str] = []
        extra_findings: List[dict] = []
        version = prompt_version

        import pymupdf

        for n, page in enumerate(pages, start=1):
            img, mt = page[0], page[1]

            # Generate lightweight high-clarity JPEG preview for frontend viewer
            try:
                p_doc = pymupdf.open(stream=img, filetype="png" if mt == "image/png" else "jpeg")
                p_pix = p_doc[0].get_pixmap(dpi=105)
                b64 = base64.b64encode(p_pix.tobytes("jpg")).decode("ascii")
                pages_rendered.append(f"data:image/jpeg;base64,{b64}")
            except Exception:
                b64 = base64.b64encode(img).decode("ascii")
                pages_rendered.append(f"data:{mt};base64,{b64}")

            svg_obs, svg_unc, svg_fnd = [], [], []
            if page.svg_raw:
                try:
                    with tempfile.NamedTemporaryFile("wb", suffix=".svg", delete=False) as tmp:
                        tmp.write(page.svg_raw)
                        tmp_path = tmp.name
                    try:
                        for v in check_fonts(tmp_path):
                            extra_findings.append(_finding(
                                "LMS-11",
                                "Font Standard Violation",
                                REVIEW,
                                f"Font size deviation in {v.category}: '{v.text}'",
                                f"Hyundai VDH Tech Pub drawing standard requires {v.expected_px}px for {v.category}, but found {v.found_px}px on sheet.",
                                expected=f"{v.expected_px}px",
                                detected=f"{v.found_px}px",
                                evidence=v.text,
                                page=n
                            ))
                    finally:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                    
                    from .svg_truth import parse_svg_sheet_full
                    svg_obs, svg_unc, svg_fnd = parse_svg_sheet_full(page.svg_raw, page_number=n)
                    extra_findings.extend(svg_fnd)
                    uncertain.extend(svg_unc)
                except Exception:
                    pass

            pdf_obs: List[Observation] = []
            if getattr(page, "text_raw", None) and not page.svg_raw:
                import re
                lines = [l.strip() for l in page.text_raw.splitlines() if l.strip()]
                for l in lines:
                    lab = WireLabel.parse(l)
                    if lab:
                        pdf_obs.append(Observation(
                            wire_no=lab.wire_no, colour=lab.colour, size=lab.size,
                            source=page.name or "INPUT.pdf", destination=None,
                            confidence=1.0, evidence=l, page=n
                        ))
                    else:
                        m = re.match(r'^(\d+(?:\.\d+)?)\s*([A-Za-z/]{1,6})$', l)
                        if m and len(m.group(2)) <= 4 and norm_colour(m.group(2)):
                            pdf_obs.append(Observation(
                                wire_no=None, colour=norm_colour(m.group(2)), size=m.group(1),
                                source=page.name or "INPUT.pdf", destination=None,
                                confidence=0.8, evidence=l, page=n
                            ))

            # Vision extraction per sheet (if client available)
            vision_ok = False
            if client is not None:
                try:
                    res = extract_sheet(client, img, mt, page=n, prompt_version=prompt_version)
                    version = res.prompt_version
                    if res.ok:
                        observations += res.observations
                        uncertain += [{**u, "page": n} for u in res.uncertain]
                        vision_ok = True
                    else:
                        client_err = res.error
                except Exception as c_exc:
                    client_err = str(c_exc)

            if not vision_ok:
                if svg_obs:
                    # Deterministic vector ground truth extraction from SVG
                    observations += svg_obs
                elif pdf_obs:
                    # Deterministic vector text extraction from PDF
                    observations += pdf_obs
                else:
                    failed.append(n)
                    errors.append(f"page {n}: {client_err or 'Vision model unavailable and sheet has no vector data'}")

        processed = len(pages) - len(failed)
        overall, findings = evaluate(observations, expected, specification_is_complete=specification_is_complete,
                                     total_pages=len(pages), processed_pages=processed, failed_pages=failed)

        # Merge deterministic font & malformed label findings
        findings.extend(extra_findings)
        if any(f["outcome"] == FAIL for f in findings):
            overall = FAIL
        elif findings or not specification_is_complete or (len(failed) > 0):
            overall = REVIEW

        index = ComponentIndex()
        return {
            "report_id": f"RPT-{uuid.uuid4().hex[:10].upper()}",
            "document_name": file.filename or "document",
            "sha256_hash": hashlib.sha256(data).hexdigest(),
            "standard": standard,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_used": getattr(client, "model", "unknown"),
            "prompt_version": version,
            "overall_outcome": overall,
            "specification_is_complete": specification_is_complete,
            "extraction_is_verified": False,  # only a human reviewer can set this
            "trusted_verification": None,
            "scope_description": scope_description,
            "rule_findings": findings,
            "candidate_observations": [
                {**o.__dict__, "destination_class": classify_destination(o.destination, index).value} for o in observations],
            "flagged_gaps": uncertain,
            "page_errors": errors,
            "pages_rendered": pages_rendered,
            "total_page_count": len(pages),
            "processed_page_count": processed,
            "failed_page_count": len(failed),
            "unprocessed_page_numbers": [],
            "failed_page_numbers": failed,
            "disclaimer": "Machine result only: candidate AI transcription checked by deterministic rules. A human reviewer must sign off.",
        }

    return app


app = create_app()
