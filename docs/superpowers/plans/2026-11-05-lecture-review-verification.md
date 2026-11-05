# V5.9 — Private lecture review verification implementation plan

> **For agentic workers:** Use test-driven-development and execute task-by-task; do not merge or deploy without independent release gates.

**Goal:** Give the lecture author a fail-closed, read-only way to check whether an original-PDF page-by-page review worksheet is fully ticked and still matches the exact draft and PDF under review.

**Architecture:** Extend existing `tools/lecture_review_report.py` and its stdlib regression tests. A generated worksheet records a SHA-256 digest of the draft JSON alongside the existing original PDF hash and reviewer-supplied page count. `--verify <report.md>` reconstructs the canonical worksheet from the present draft and private PDF, allows only checkboxes to change, rejects stale/tampered evidence and ambiguous/missing/out-of-range source page claims, and requires every page/text/figure/table/manual checklist box to be checked. Verification never changes files or constitutes clinical approval.

**Tech Stack:** Python 3 stdlib, GitHub Actions source/Chromium/WebKit gates.

**Scope / preservation:** Source PDFs remain private and are hashed only; original clinical image packs, lecture JSON, `main`, IndexedDB, answer keys, cached/offline study progress and Worker settings stay untouched. No new dependencies or network calls. Existing report generation and existing unverified worksheets remain supported; the new verification mode requires a freshly generated worksheet.

## Tasks

### Task 1 — RED / Behavior tests
- [ ] Add tests to `tests/test_lecture_review_report.py` for complete review, incomplete review, stale draft/PDF, edited report, ambiguous/missing source pages and invalid or missing page-count.
- [ ] Run on existing code and observe expected missing verifier behavior (RED).

### Task 2 — GREEN / Verification functionality
- [ ] Add optional `draft_hash` to `build_report` without changing direct callers.
- [ ] Compute actual source JSON SHA-256 on CLI generation and print it in the worksheet.
- [ ] Add `--verify` read-only mode, requiring `--pdf` and `--page-count`.
- [ ] Verify fresh report structure, unchanged draft/PDF evidence and checked per-page/text/figure/table plus manual sign-off checklist; refuse false medical approval claims.
- [ ] Run focused stdlib tests and full repository quality CI; report exact outcomes.

### Task 3 — Docs / Review handoff
- [ ] Document generate → manually inspect every source page → tick the checklist → verify → separately approve/registration workflow in `CONTENT_AUTHORING.md`.
- [ ] Create a draft PR stacked on #80/#79/#78/#76/#75 and check exact source CI.
- [ ] Do not merge until release blocker #50 is independently resolved and authenticated production smoke #35 can be demonstrated.

## Risks
- A checked box proves only that a person asserted review, not that the medical content is correct.
- A PDF SHA proves file identity, not page count; `--page-count` is supplied by reviewer.
- No permission to copy protected PDF images to public GitHub.
