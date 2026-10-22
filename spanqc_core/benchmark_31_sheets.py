"""Benchmark runner for all 31 Tech Pub sheets (JPG vs SVG ground truth).
Compares extract_v1 vs extract_v2 and evaluates accuracy and fabricated count."""
import os
import sys
import json
from pathlib import Path

# Add spanqc_core root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from spanqc_core.extract import AnthropicClient, extract_sheet
from spanqc_core.svg_truth import parse_svg_sheet
from spanqc_core.score import score_sheet, aggregate

JPG_DIR = Path("/data/projects/LMS/PROJECT INFO (1)/PROJECT INFO/OUTPUT/JPG")
SVG_DIR = Path("/data/projects/LMS/PROJECT INFO (1)/PROJECT INFO/OUTPUT/SVG")

def run_benchmark():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[ERROR] ANTHROPIC_API_KEY is not set in the environment.")
        print("Please export ANTHROPIC_API_KEY=... and re-run.")
        sys.exit(1)

    client = AnthropicClient(api_key=api_key)

    jpg_files = sorted(list(JPG_DIR.glob("*.jpg")))
    print(f"Found {len(jpg_files)} JPG sheets in {JPG_DIR}")

    for version in ["extract_v1", "extract_v2"]:
        print(f"\n==========================================")
        print(f"RUNNING BENCHMARK: {version}")
        print(f"==========================================")
        scores = []
        for idx, jpg_path in enumerate(jpg_files, 1):
            sheet_name = jpg_path.stem
            svg_path = SVG_DIR / f"{sheet_name}.svg"

            if not svg_path.exists():
                print(f"[{idx}/{len(jpg_files)}] Warning: SVG answer key not found for {sheet_name}. Skipping.")
                continue

            # Read ground truth from SVG
            truth_labels, anomalies = parse_svg_sheet(svg_path.read_text(encoding="utf-8"))

            # Read JPG image
            image_bytes = jpg_path.read_bytes()

            print(f"[{idx}/{len(jpg_files)}] Transcribing {sheet_name} with {version}...", end="", flush=True)
            res = extract_sheet(client, image_bytes, "image/jpeg", prompt_version=version)

            if res.error:
                print(f" FAILED: {res.error}")
                continue

            score = score_sheet(sheet_name, truth_labels, res.observations, anomalies)
            scores.append(score)
            print(f" Done. Precision: {score.precision:.2%}, Fabricated: {len(score.fabricated)}, Missed: {len(score.missed)}")

        agg = aggregate(scores)
        print(f"\nAGGREGATE RESULTS FOR {version}:")
        print(json.dumps(agg, indent=2))

        # Check for sheet 2-5 anomaly transcription
        s25 = next((s for s in scores if s.sheet == "2-5"), None)
        if s25:
            print(f"\nSheet 2-5 Detail ({version}):")
            print(f"  Fabricated: {s25.fabricated}")
            print(f"  Missed: {s25.missed}")

if __name__ == "__main__":
    run_benchmark()
