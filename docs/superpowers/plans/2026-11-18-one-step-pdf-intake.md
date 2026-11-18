# A1.2 One-Step Private PDF Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkboxes track observed evidence, not assumptions.

**Goal:** From Manage Library's downloaded `.intake.json` and the matching original PDF, produce the same private source review bundle in one step with a source-to-topic page mapping worksheet.

**Architecture:** Extend the existing `tools/pdf_source_inventory.py` locally only; call the already reviewed `import_library_draft.prepare_intake` validator rather than reproducing course/title/ID/topic checks. Keep existing `--draft` flow and `lecture_review_report.build_report` exactly as gated before. No browser-side Python, no external API, no clinical generation.

**Tech Stack:** Python 3.13, existing optional PyMuPDF, stdlib unittest, exact-head GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-meq-study-first-recovery-design.md` (planning PR #103), `CONTENT_AUTHORING.md`, `AGENTS.md`; builds on PR #108.

## Global Constraints

- Lecture-First Policy; source images only, exact byte hashes, no AI clinical images, answers, OCR or medical claims.
- Do not modify published medical JSON, question IDs, ratings, backups, PWA, Cloudflare, registry or student data.
- Never check source PDF, private intake, extracted text or figure content into public GitHub.
- Fail closed on unsupported intake schema, wrong filename, unregistered material, duplicate IDs, unsafe output paths, existing destination, invalid PDF or missing PyMuPDF.
- Imported draft remains private, empty and `needs-source-review`. Topic-to-source references remain unchecked until someone verifies original pages.
- No framework or dependency additions; existing optional PyMuPDF source tool is reused.
- Full source tests and static/Chromium/WebKit exact-head CI required before declaring test success.

## Review Focus

1. Valid 2-topic intake + 3-page synthetic PDF makes `source-topic-map.md`, exact draft and hashes in private output with no publication side effects.
2. Malicious JSON `approval=approved`, duplicate topics, nonexistent course, wrong PDF filename, oversized intake all fail without output.
3. Existing `--draft` still creates source review with no new required fields and no accidental approval.
4. Refuse `--intake` plus `--draft` and refuse destination overwrite, including repo-root tracked paths.
5. Arabic, embedded pipe and other topic labels render safely in Markdown; source pages unassigned and all boxes unchecked.

### Task 1 — test-first RED

**Files:** `tests/test_pdf_source_inventory.py`

- [ ] Add a valid source-neutral intake fixture matching wizard `medical-library-intake` v1 with real surgery/urology registry, unique synthetic ID and two topics.
- [ ] Run standalone tests on parent PR code: `create_private_bundle(..., intake_path=...)` must fail before implementation.
- [ ] Add rejection tests for wrong filename, unknown approval, duplicate label, oversized request and mutual exclusion.

### Task 2 — minimal one-step bridge

**Files:** `tools/pdf_source_inventory.py`

- [ ] Load and validate intake bytes (<=128KB), validate exact filename, call `prepare_intake` using real repo import rules; preserve raw request hash and validated draft bytes.
- [ ] Add `intake_path` argument to `create_private_bundle` and CLI `--intake` mutually exclusive with `--draft`.
- [ ] Write `intake-request.json` for provenance, `lecture-draft.json` and existing unchecked hash-tied `review.md`.
- [ ] Generate `source-topic-map.md` showing each authored topic and blank PDF page field / unchecked human signoff, without inferring text matches.
- [ ] Keep atomic staging/no overwrites/no tracked repo output.

### Task 3 — proof and handoff

**Files:** `CONTENT_AUTHORING.md`, `docs/project-autopilot` checkpoint or PR description.

- [ ] Run synthetic 3-page end-to-end PDF test locally and exact-head GitHub `pdf-source-quality`, static, Chromium and WebKit.
- [ ] Document one-command route; keep legacy --draft route and no browser auto-PDF extraction claims.
- [ ] Inspect PR diff for any medical/source media/PWA/Cloudflare changes; none permitted.
- [ ] Leave PR unmerged/unreleased until Cloudflare build-only #50 and owner Access smoke #35 are proved; main release version unchanged.
