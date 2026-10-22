import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from conftest import FIX, FakeClient, reply, wire
from spanqc_core.api import create_app
from spanqc_core.svg_truth import component_codes, cross_references, svg_texts, truth_labels
import hashlib

EXPECTED = json.dumps([{"wire_no": "122A", "colour": "WH", "size_mm2": 1.5, "source": "CFB1", "destination": "CN-36"}])


def post(app, png, **form):
    return TestClient(app).post("/api/v1/analyze", files={"file": ("s.png", png, "image/png")}, data=form)


def test_contract_fields_and_hash(png_bytes):
    app = create_app(lambda: FakeClient([reply([wire()])]))
    r = post(app, png_bytes, expected_netlist_json=EXPECTED, specification_is_complete="true")
    j = r.json()
    assert r.status_code == 200 and j["overall_outcome"] == "PASS"
    assert j["sha256_hash"] == hashlib.sha256(png_bytes).hexdigest()
    for k in ("report_id", "rule_findings", "candidate_observations", "total_page_count", "processed_page_count", "failed_page_numbers", "model_used", "prompt_version"):
        assert k in j
    assert j["extraction_is_verified"] is False  # only a human may set this


def test_no_api_key_fails_closed_with_503(png_bytes, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = post(create_app(), png_bytes)
    assert r.status_code == 503 and "ANTHROPIC_API_KEY" in r.json()["detail"]


def test_model_failure_never_passes(png_bytes):
    app = create_app(lambda: FakeClient([RuntimeError("boom")]))
    j = post(app, png_bytes, expected_netlist_json=EXPECTED, specification_is_complete="true").json()
    assert j["overall_outcome"] == "REVIEW" and j["failed_page_numbers"] == [1] and j["page_errors"]


def test_wrong_colour_fails(png_bytes):
    app = create_app(lambda: FakeClient([reply([wire(col="BK", ev="122A BK 1.5")])]))
    j = post(app, png_bytes, expected_netlist_json=EXPECTED, specification_is_complete="true").json()
    assert j["overall_outcome"] == "FAIL"


def test_bad_inputs_rejected(png_bytes):
    app = create_app(lambda: FakeClient([]))
    assert TestClient(app).post("/api/v1/analyze", files={"file": ("x.txt", b"hello", "text/plain")}).status_code == 415
    assert post(app, png_bytes, expected_netlist_json="{not json").status_code == 422


def test_pdf_pages_are_split_and_each_sent(png_bytes):
    import pymupdf
    doc = pymupdf.open(); doc.new_page(); doc.new_page()
    client = FakeClient([reply([wire()]), reply([wire()])])
    r = TestClient(create_app(lambda: client)).post("/api/v1/analyze", files={"file": ("d.pdf", doc.tobytes(), "application/pdf")})
    assert r.status_code == 200 and client.calls == 2 and r.json()["total_page_count"] == 2


def test_svg_direct_upload_is_rendered():
    svg_data = b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
    client = FakeClient([reply([wire()])])
    r = TestClient(create_app(lambda: client)).post("/api/v1/analyze", files={"file": ("diagram.svg", svg_data, "image/svg+xml")})
    assert r.status_code == 200 and client.calls == 1 and r.json()["total_page_count"] == 1


def test_zip_with_multiple_diagrams_extracted_and_processed(png_bytes):
    import io, zipfile
    svg_data = b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>'
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as zf:
        zf.writestr("sheet1.png", png_bytes)
        zf.writestr("sheet2.svg", svg_data)
        zf.writestr("ignored_notes.txt", b"plain text notes")

    client = FakeClient([reply([wire()]), reply([wire()])])
    r = TestClient(create_app(lambda: client)).post(
        "/api/v1/analyze",
        files={"file": ("schematics.zip", zb.getvalue(), "application/zip")},
        data={"specification_is_complete": "true"}
    )
    assert r.status_code == 200
    assert client.calls == 2
    assert r.json()["total_page_count"] == 2


def test_empty_or_no_diagram_zip_rejected():
    import io, zipfile
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as zf:
        zf.writestr("readme.txt", b"no diagrams here")

    app = create_app(lambda: FakeClient([]))
    r = TestClient(app).post("/api/v1/analyze", files={"file": ("empty.zip", zb.getvalue(), "application/zip")})
    assert r.status_code == 422



# ---- real data: the Tech Pub output SVGs act as ground truth ----
@pytest.mark.parametrize("name,minimum", [("FB1-1.svg", 20), ("2-1.svg", 20), ("5.svg", 20)])
def test_real_svg_ground_truth_has_wire_labels(name, minimum):
    labels = truth_labels(FIX / name)
    assert len(labels) >= minimum and all(l.colour for l in labels) and any(l.size is None for l in labels) is not None


def test_real_svg_components_and_xrefs():
    texts = svg_texts(FIX / "FB1-1.svg")
    assert "CFB1" in component_codes(texts) and any(x.startswith("CECM:CN-93") for x in cross_references(texts))


# ---- anomalies: transcribe as printed, never repair ----
from spanqc_core.svg_truth import malformed_labels
from spanqc_core.score import score_sheet
from spanqc_core.rules import Expected, Observation, evaluate


def test_real_sheet_has_one_malformed_label():
    assert malformed_labels(FIX / "2-5.svg") == ["81K BKWH 1.0"]
    assert malformed_labels(FIX / "FB1-1.svg") == []


def test_repairing_an_anomaly_counts_as_fabrication_and_faithful_copy_does_not():
    anomalies = ["81K BKWH 1.0"]
    repaired = score_sheet("S", [], ["81K BK/WH 1.0"], anomalies)
    faithful = score_sheet("S", [], ["81K BKWH 1.0"], anomalies)
    assert repaired.fabricated and repaired.matched == 0
    assert not faithful.fabricated and faithful.matched == 1 and not faithful.missed


def test_engine_flags_the_malformed_code_instead_of_passing_it():
    out, f = evaluate([Observation("81K", "BKWH", "1.0")], [Expected("81K", "BK/WH", "1.0")], specification_is_complete=True)
    assert out == "REVIEW" and f[0]["rule_id"] == "LMS-06"


def test_prompt_v2_changes_only_rule_8():
    from spanqc_core.extract import load_prompt
    _, v1 = load_prompt("extract_v1"); _, v2 = load_prompt("extract_v2")
    added = [l for l in v2.splitlines() if l not in v1.splitlines()]
    assert any("EXACTLY as printed" in l for l in added) and not any("1." in l[:3] for l in added)
    assert v1.count("## Hard rules") == v2.count("## Hard rules") == 1


def test_svg_font_violation_and_previews_flagged_in_api():
    svg_12_1 = (FIX / "12-1.svg").read_bytes()
    app = create_app(lambda: FakeClient([reply([wire()])]))
    r = TestClient(app).post("/api/v1/analyze", files={"file": ("12-1.svg", svg_12_1, "image/svg+xml")})
    assert r.status_code == 200
    j = r.json()
    rule_ids = [f["rule_id"] for f in j["rule_findings"]]
    assert "LMS-11" in rule_ids
    assert len(j["pages_rendered"]) == 1
    assert j["pages_rendered"][0].startswith("data:image/jpeg;base64,")


def test_svg_malformed_label_flagged_in_api():
    svg_2_5 = (FIX / "2-5.svg").read_bytes()
    app = create_app(lambda: FakeClient([reply([wire()])]))
    r = TestClient(app).post("/api/v1/analyze", files={"file": ("2-5.svg", svg_2_5, "image/svg+xml")})
    assert r.status_code == 200
    j = r.json()
    rule_ids = [f["rule_id"] for f in j["rule_findings"]]
    assert "LMS-06" in rule_ids
    assert len(j["pages_rendered"]) == 1


def test_svg_unused_fuse_stubs_and_vector_fallback_in_api():
    svg_1_fb1_6 = Path("/data/projects/LMS/PROJECT INFO (1)/PROJECT INFO/OUTPUT/SVG/1 FB1-6.svg")
    if not svg_1_fb1_6.exists():
        svg_1_fb1_6 = Path("/data/projects/uiux/test_data/LMS/LMS (2)/PROJECT INFO (1)/PROJECT INFO/OUTPUT/SVG/1 FB1-6.svg")
    data = svg_1_fb1_6.read_bytes()
    # Test client without vision model (vector fallback)
    app = create_app(lambda: None)
    r = TestClient(app).post("/api/v1/analyze", files={"file": ("1 FB1-6.svg", data, "image/svg+xml")})
    assert r.status_code == 200
    j = r.json()
    rule_ids = [f["rule_id"] for f in j["rule_findings"]]
    assert "LMS-09" in rule_ids
    # Check that observations were extracted deterministically from vector SVG
    assert len(j["candidate_observations"]) >= 8
    # F35 and F36 must be in flagged gaps
    flagged_whats = [g["what"] for g in j["flagged_gaps"]]
    assert any("F35" in w for w in flagged_whats)
    assert any("F36" in w for w in flagged_whats)


