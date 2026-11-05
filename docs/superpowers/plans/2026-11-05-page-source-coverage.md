# V5.7 — Page-by-page Source Coverage Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans and test-driven-development. Complete tests RED -> implementation -> exact-head CI -> checkpoint.

**Goal:** Help the learner audit *every page* and every information-bearing source figure/table before approving a new lecture, without claiming machine-verified PDF content or adding medical facts.

**Architecture:** Extend the existing private, local-only `tools/lecture_review_report.py` Markdown review checklist. When a reviewer supplies `--page-count`, derive a conservative **claimed page map** only from explicit single-page references in Explanation, MCQ, image questions and optional infographic. Render one **unchecked review row for every page**, separately prompting review of text, images/legends, and tables/graphs. Flag missing, ambiguous and out-of-bounds references instead of guessing. No new dependencies, PDF extraction, changes to registered material or publication gates.

**Tech Stack:** Python stdlib, `unittest`, GitHub Actions. No new user-facing website UI.

**Spec:** Personal library roadmap #74, `CONTENT_AUTHORING.md` original-only visual policy, the existing `tests/test_lecture_review_report.py` and V5.6 PR #79.

## Global constraints
- **Lecture-First Policy:** the uploaded/private original PDF is the only exam-fact authority; this feature does not create/verify clinical explanations, image facts, numeric values or answer keys.
- Page counts remain **reviewer-supplied**, not extracted automatically. A source reference **claims** a page, but does not prove the page is completely summarized, medically reviewed or safe to redistribute.
- No storage of private PDFs, no image downloads, no OCR, no public publication and no modification to `lectures/data/*.json`, source hashes or course catalogs.
- Existing `build_report(lecture, pdf_name='', pdf_hash='', page_count=None)` interface and CLI `--pdf`, `--page-count`, `--output` must stay compatible.
- Markdown output escapes untrusted question text and page labels; ambiguous ranges/multiple pages are flagged for manual review.
- The feature is **stacked after PRs #75, #76, #78, #79** and must not be merged/deployed until CI and Cloudflare Access #35 / promotion #50 gates are satisfied.

## Task 1 — Write failing tests (RED)
**File:** `tests/test_lecture_review_report.py`
- Test 5-page source: exactly five rows, with source citations on 1,2,4,5; page 3 explicitly unlinked; per-page unchecked text, visual legend and tabular-data review; no automatic coverage/approval claims.
- Test numeric image source page, ambiguous `PDF pp. 2-4`, out-of-bounds `PDF p.8` vs 4 declared pages, and invalid `page_count` direct input.
- Test missing `--page-count` generates an explicit page-review limitation while preserving existing summary.
**Verification:** GitHub PR static gate fails in the new assertions, before implementation.

## Task 2 — Implement a conservative page map
**File:** `tools/lecture_review_report.py`
- Add a small helper parsing only explicit **single** page refs, e.g. `PDF p.4`, `PDF page 4`, `Slide 3`, `Page 2`, or a positive integer image page; do not infer a page from ambiguous text.
- On known page count add one checklist row per page and a clear no-source-link note. Maintain source-to-page reference counting and a list of labels requiring manual resolution.
- Reject invalid direct `page_count` inputs; preserve all earlier sections/CLI behavior.

## Task 3 — Explain manual review & verify
**Files:** `CONTENT_AUTHORING.md`, `docs/superpowers/plans/2026-11-05-page-source-coverage.md`
- Explain the workflow: original PDF -> factual/visual page inventory -> reviewed lecture JSON -> local report -> manually check text/images/legends/tables per page -> source approval -> dry run -> `--write --reviewed`.
- Run full static, Chromium, WebKit through GitHub Actions on exact final SHA. Inspect incremental diff for medical source, storage, UI, config or dependency changes. Record status in PR #80 and roadmap #74 without claiming deployment.
