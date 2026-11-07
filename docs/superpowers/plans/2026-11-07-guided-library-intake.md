# Guided library intake implementation plan

**Goal:** A usable metadata-only authoring route with a validated handoff to existing private lecture drafts.
**Architecture:** Native four-step form; existing course registry/catalog metadata; strict versioned local export; existing Python draft preparation and review gates.
**Stack:** Vanilla JS/CSS, Python stdlib, Playwright/axe. No new dependencies.
**Spec:** `docs/superpowers/specs/2026-11-07-guided-library-intake.md`.

## Constraints and review focus

Preserve medical payloads, IDs, images, progress, exam scoring and the five learner destinations. No direct publication or private PDF upload. Check stale scope, pending draft collisions, non-ASCII text, unsafe paths/unknown fields, offline parity and accidental approval claims.

### Task 1: Authoring contract and private importer
- [x] Add browser tests for route, step validation, export/CLI handoff and responsive/offline states. Initial launch was blocked by missing browser binaries; subsequent skip-navigation and ID-boundary regressions were observed failing against actual browser behavior before their fixes.
- [x] Add Python tests for strict intake metadata, collisions, Chapter scope, exclusive writes and empty-publication refusal; observed missing importer, unsupported Chapter and accepted invalid-ID failures before the corresponding implementation/fixes.
- [x] Implement `prepare_intake(document)` and CLI preview/`--write` in `tools/import_library_draft.py`, reusing `prepare_draft`.
- [x] Preserve optional draft Chapter through reviewed registration in `tools/add_lecture.py`; test actual catalog/source separation.

### Task 2: Manage Library workspace
- [x] Add semantic form in `src/index.html`, route in `src/app.js`, standalone `src/library-authoring.js` and CSS; reuse V6 tokens.
- [x] Wire module into builder, offline output, versioned service-worker shell cache and source syntax checks; bump aligned release candidate version.
- [x] Run focused tests; inspect desktop/mobile screenshots, then full static/Chromium/WebKit gates. Source `1b3ddfa`: official run #42392300567 green; 70 Python / 217 Chromium / 16 WebKit + 2 intentional skips. Six preview authoring scenarios passed.

### Task 3: Review and truthful handoff
- [x] Independent code/design review; reproduced and fixed reader-incompatible IDs. Narrow verdict scored the finding and stable-theme recapture resolved; documenter verification passed.
- [x] Update authoring docs and `PROJECT_PROGRESS.md` with real evidence and remaining UX/release gates.
- [x] Commit and preserve a reviewable candidate branch/[draft PR #89](https://github.com/Hafezalhoot/medical-meq-bank/pull/89); no merge or promotion through unresolved Cloudflare blockers.
