# spanqc_core — Tech Pub wiring-sheet verifier (LMS / Hyundai VDH rule set)

Replaces the old `experiments/llm-qc-demo` Python service. Same endpoint your Next.js job-bridge already calls:
`POST /api/v1/analyze` (multipart) -> JSON with `report_id`, `sha256_hash`, `overall_outcome`, `rule_findings`, page-coverage fields.

## Run
    python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
    PYTHONPATH=. pytest tests -q                     # expect 89 passed
    export ANTHROPIC_API_KEY=...                     # server-side only. No key => HTTP 503 (fails closed)
    export ANTHROPIC_WORKSPACE_ID=...                # only if your key is not scoped to a workspace
    PYTHONPATH=. uvicorn spanqc_core.api:app --port 8000

Point the job-bridge's Python-service URL at `http://127.0.0.1:8000`.
Optional form field `prompt_version` (default `extract_v1`; `extract_v2` adds rule 8). Env `SPANQC_MODEL` (default claude-sonnet-4-6).

## What is where
| File | Job |
|---|---|
| `wirecodes.py` | parse labels (`122A WH/RD 1.5`, `WH 2.0`, `4 RD`, `G18 BK 0.75`); numeric mm2 compare (`2`==`2.0`); exact ordered colour codes |
| `classify.py` | green / yellow / grey / blue; strips `(pin)` suffix BEFORE lookup |
| `rules.py` | deterministic engine (LMS-01..12); never PASS on wrong/ambiguous/partial |
| `extract.py` | Claude call + fail-closed parsing (truncation, bad JSON, evidence guard) |
| `score.py` | golden-set scoring + prompt change log; fabricated count must stay 0 |
| `svg_truth.py` | reads the Tech Pub SVGs = answer key for each JPG; finds malformed labels |
| `fontcheck.py` | LMS font-size standards from SVG text sizes (KL 8, component 10, connector 7, wire label 7) |
| `report.py` | multi-tab Excel incl. prompt version |
| `api.py` | FastAPI service |
| `prompts/` | `extract_v1.md`, `extract_v2.md` (v2 = v1 + rule 8, nothing else) |
| `demo/` | the two real baseline transcriptions + `prompt_change_log.json` |

## Reference-netlist format (changed from the old service)
`expected_netlist_json` = `[{"wire_no":"122A","colour":"WH","size_mm2":1.5,"source":"CFB1","destination":"CN-36"}, ...]`
(any field except `wire_no` may be omitted = not checked). A machine PASS never sets `extraction_is_verified`; a human does.

## NOT done / not verified
* No live Claude run has been made (no API key where this was built). Baselines are a manual read by a Claude session, not the production model/prompt.
* Component lookup uses a placeholder index built from sheet text. Plug in the HX Codes sheet (NEW CODE authoritative, DROP disambiguates) in `classify.ComponentIndex`.
* Only wire labels are scored; endpoints/pins are not yet in the golden set (needs the verified FB1 workbook).
* Symbology and grid-reference checks from the LMS are not implemented. Font check covers 4 categories only (pin numbers, grid/ref and 'options' need position data or a confirmed standard).
* Real findings so far: malformed label `81K BKWH 1.0` (sheet 2-5) and `CCR1` at 8 px instead of 10 px (sheet 12-1): both candidates for human review.
