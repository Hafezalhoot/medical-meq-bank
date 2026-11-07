# Guided library intake implementation plan

**Goal:** A usable metadata-only authoring route with a validated handoff to existing private lecture drafts.
**Architecture:** Native four-step form; existing course registry/catalog metadata; strict versioned local export; existing Python draft preparation and review gates.
**Stack:** Vanilla JS/CSS, Python stdlib, Playwright/axe. No new dependencies.
**Spec:** `docs/superpowers/specs/2026-11-07-guided-library-intake.md`.

## Constraints and review focus

Preserve medical payloads, IDs, images, progress, exam scoring and the five learner destinations. No direct publication or private PDF upload. Check stale scope, pending draft collisions, non-ASCII text, unsafe paths/unknown fields, offline parity and accidental approval claims.

### Task 1: Authoring contract and private importer
- [ ] Add browser tests for route, step validation, export/CLI handoff and responsive/offline states; run and observe missing Manage route.
- [ ] Add Python tests for strict intake metadata, collisions, Chapter scope, exclusive writes and empty-publication refusal; observe failure before implementation.
- [ ] Implement `prepare_intake(document)` and CLI preview/`--write` in `tools/import_library_draft.py`, reusing `prepare_draft`.
- [ ] Preserve optional draft Chapter through reviewed registration in `tools/add_lecture.py`; test actual catalog/source separation.

### Task 2: Manage Library workspace
- [ ] Add semantic form in `src/index.html`, route in `src/app.js`, standalone `src/library-authoring.js` and CSS; reuse V6 tokens.
- [ ] Wire module into builder, offline output, versioned service-worker shell cache and source syntax checks; bump aligned release candidate version.
- [ ] Run focused tests; inspect desktop/mobile screenshots, then full static/Chromium/WebKit gates.

### Task 3: Review and truthful handoff
- [ ] Independent code/design review; address material findings and verify.
- [ ] Update authoring docs and `PROJECT_PROGRESS.md` with real evidence and remaining UX/release gates.
- [ ] Commit and preserve a reviewable candidate branch/PR; do not merge or promote through unresolved Cloudflare/CI blockers.
