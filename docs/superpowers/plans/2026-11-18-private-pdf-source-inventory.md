# A1 Source-PDF Inventory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps are checkboxes for verification, not claims of completion.

**Goal:** Given a private learner-owned PDF and an optional unpublished lecture draft, create a source-preserving page inventory, exact source-image fingerprints, optional private visual previews and the existing gated medical review worksheet — without publishing any content.

**Architecture:** New optional local Python CLI `tools/pdf_source_inventory.py` reuses the repo's existing optional private PyMuPDF requirement and `lecture_review_report.build_report`. It only writes under a private, nontracked output directory; clinical source JSON, catalogs, question keys, PWA, service worker and Cloudflare production are never modified.

**Tech Stack:** Python 3, optional PyMuPDF >=1.24,<2; standard-library unittest; current Python static checks.

**Spec:** `docs/superpowers/specs/2026-11-18-meq-study-first-recovery-design.md` (planning PR #103), `CONTENT_AUTHORING.md`, `AGENTS.md`.

## Constraints / rulings

- Source PDF can contain copyrighted or sensitive teaching data; outputs remain local/private, never uploaded to the public repo by the CLI.
- No OCR, automatic medical answers, exam facts, regenerated clinical images or auto-publication.
- Native PDF text may miss annotations, scans, embedded diagrams, captions and tables. Every page must remain NEEDS SOURCE REVIEW and unchecked even if extraction succeeds.
- An optional draft must have exact source filename matching the original PDF. Review worksheet must be tied to original PDF SHA-256 and exact draft bytes; use existing `lecture_review_report` instead of a parallel approval engine.
- File checks: real PDF header, valid extension, size cap, nonempty/unlocked document, page-count ceiling, original embedded image byte SHA-256, no silent overwrite.
- Destination inside Git repository must stay under ignored `tmp/`; write atomically, and keep preview and original-image bytes in private local storage.
- Do not modify `lectures/data`, `assets`, ratings, course catalogs, PWA version, Cloudflare settings or main.

## Task 1 — RED tests and local synthetic source

**Files:** `tests/test_pdf_source_inventory.py`

- [ ] Write failing tests for 3-page synthetic nonmedical PDF with a native-text page, source embedded-image page, and blank page.
- [ ] Assert PDF hash/page count/actual source bytes and individual native text; all page review states pending.
- [ ] Assert missing/false PDF header, encrypted source, wrong source filename in draft, private destination overwrite and tracked-repo output fail closed.
- [ ] Prove failure of the test before the CLI exists.

## Task 2 — Minimal source inventory CLI

**Files:** `tools/pdf_source_inventory.py`

- [ ] Lazy import existing optional PyMuPDF dependency. Scan each page for native text, exact embedded image SHA-256, vector drawing path count and review-required flags.
- [ ] Return strictly source-neutral JSON; do not infer medical facts.
- [ ] Write private `source-inventory.json`, `source-index.md`, `source-pages/page-NNNN.txt`; optional source-rendered `page-previews/` and exact source-image payload `original-images/`.
- [ ] If `--draft` provided, verify source filename, copy original draft bytes into same private destination and generate `review.md` with `lecture_review_report.build_report` (all boxes unchecked).
- [ ] Refuse existing output folder or any tracked repository output. All-or-nothing directory commit.

## Task 3 — Quality gate and documentation

**Files:** `build.sh`, `CONTENT_AUTHORING.md`, `tests/test_pdf_source_inventory.py`

- [ ] Add CLI/test syntax and pure unittest checks to static build; do not install new runtime PWA dependencies. Tests requiring PyMuPDF may skip in CI unless optional authoring environment is provisioned; run synthetic integration locally with PyMuPDF and explicitly report skip counts.
- [ ] Document commands from Manage Library `*.intake.json` → `import_library_draft.py --write` → `pdf_source_inventory.py --draft --render-pages --extract-images` → page-by-page reviewer edits → existing `add_lecture.py` review gates.
- [ ] Explain no automatic PDF-to-MCQ generation and no publishing; original figures only, private payloads, manuscript owner/editorial approval.
- [ ] Run real local synthetic PDF 3-page integration tests, Python compile, GitHub exact-head Static/Chromium/WebKit for no regression. Verify no medical payload or source media changes.
- [ ] Record PR head SHA, CI runs, merged/released state separately. No merge while Cloudflare auto-activation #50/Access #35 unresolved.

## Follow-on (not part of this safe source-inventory slice)

- A1.2 reviewer-assisted PDF topic alignment, figure/text coverage UI and per-question citations for a *real original lecture provided and authorized by the learner*.
- A1.3 full medical editorial review + protected catalog addition in a separate PR; cannot fill actual medical content from absent/unverified source.
- UI-only static PWA cannot run Python on Cloudflare client devices; do not pretend selecting a PDF filename equals full extraction.
