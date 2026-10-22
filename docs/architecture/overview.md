# Architecture
Browser -> Next.js (auth, uploads, job queue, reports, review) -> Python verifier `spanqc_core` (`/api/v1/analyze`) -> Anthropic API.
Per page: render -> model transcription (`prompts/extract_vN.md`) -> `rules.evaluate` -> `classify` -> report.
Guards at both layers: coverage (partial pages can't PASS) and precedence (FAIL > REVIEW > PASS).
Storage: SQLite (dev) -> Postgres (prod); uploads deleted after processing unless the lead decides otherwise.
