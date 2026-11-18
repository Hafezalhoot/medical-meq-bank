# U1 Library First Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development when available) to implement this plan task-by-task. Steps are checkboxes for durable tracking.

**Goal:** The first actual study action must appear in the initial viewport at 320x700 and 390x844 without removing the existing Library/search/authoring/resume features.

**Architecture:** Keep the current /#/library route, metadata-first catalogue and MEQStudyPosition/MEQWorkspace. Fix duplicated chrome and mobile layout only; no medical JSON or storage schema change.

**Tech Stack:** Vanilla JS/CSS/HTML, Playwright, Python build/content validators, PWA.

**Spec:** docs/superpowers/specs/2026-11-18-meq-study-first-recovery-design.md, docs/project-autopilot/MEQ_REMEDIATION_MASTER_PLAN_2026-11-18.md.

## Global Constraints

- Preserve question IDs, answerIndex, lecture bytes, source image assets, IndexedDB and backup/unfinished-exam semantics.
- Preserve #courseSelector, #subjectSelector, #libraryLectureSearch, #libraryAddLectureLink, #continueLastStudyCard, .lecture-overview-card and canonical deep links.
- Keep each essential mobile action around 44px touch size; non-color-only state, visible keyboard focus, normal text contrast >=4.5:1.
- Test 320/390/768/1024/1440px, 200% zoom, dark/light, long RTL/LTR names, print/offline, reduced motion.
- Never infer production deployment from GitHub merge; Access #35 and release issue #50 remain independent.

## Review Focus

1. Fresh/no-saved-position: first real lecture card visible in first viewport.
2. Valid saved position: Continue opens correct course, specialty, lecture and saved section, leaving ratings unchanged.
3. Stale invalid saved position: no broken Continue CTA or empty destination.
4. Library search zero results: clear action to reset without hiding add-lecture or scope controls.
5. 200% zoom / 138% reader font: no document overflow or clipped buttons; Back/Forward restores context.

---

### Task 1: Create a failing, measurable mobile Library regression

**Files:**
- Create: tests/library-first-screen.spec.js
- Inspect: tests/v6-workspace.spec.js; tests/layout.spec.js; tests/workspace-visual-evidence.spec.js

**Interfaces:**
- Consumes /#/library and .lecture-overview-card.
- Produces Playwright first-card/overflow assertions used in Task 2.

- [ ] Step 1: Use Playwright at 320x700 on /#/library, await first .lecture-overview-card and assert its boundingBox.y <=430.
- [ ] Step 2: Run npx playwright test tests/library-first-screen.spec.js --project=chromium. Expected baseline failure: observed audit y approximately 651, but record fresh value before patching.
- [ ] Step 3: Add analogous 390x844 first-card<=430, 768/1024/1440 and documentElement.scrollWidth-innerWidth<=1; test at least one dark and one 200%-zoom state.
- [ ] Step 4: Save before screenshots with test artifact and commit the RED test only.

### Task 2: Compact the actual Library context

**Files:**
- Modify: src/index.html (only if a contextual group needs markup).
- Modify: src/app.css (scoped Library responsive overrides, avoiding new global tokens).
- Modify: src/app.js only if needed; do not restructure unrelated reader/exam flows.
- Test: tests/library-first-screen.spec.js and tests/v6-workspace.spec.js.

**Interfaces:**
- Reuse existing renderLectureOverview() and MEQWorkspace.openLecture(id); keep stable links and section metadata.

- [ ] Step 1: Measure vertical layout blocks via getBoundingClientRect and identify duplicate headings/margins that bury the first card.
- [ ] Step 2: Create one compact Library context row for current Material and specialty; make chapter/advanced selection discoverable without reproducing large text on the main path.
- [ ] Step 3: Keep search visible and Add lecture draft accessible, while letting Continue or the first lecture card lead the visual hierarchy.
- [ ] Step 4: Ensure hidden #continueLastStudyCard reserves no space; when valid it appears above lecture cards without blocking keyboard or controls.
- [ ] Step 5: Rerun targeted Playwright. Expected green: y<=430 at 320/390 with no horizontal document overflow.
- [ ] Step 6: Commit only layout/interaction files and regression tests.

### Task 3: Prove navigation and study state protection

**Files:**
- Modify/tests: tests/library-first-screen.spec.js.
- Verify: src/study-position.js, src/study-context.js, tests/study-preservation.spec.js.

- [ ] Step 1: Use existing MEQStudyPosition.read()/save() API or its real approved fixture to seed a valid saved source section; assert Continue navigates to exact lecture and section.
- [ ] Step 2: Compare exported MEQProgressStore ratings before/after opening Continue and Back/Forward; they must be equal.
- [ ] Step 3: Seed an invalid/stale record in isolated test profile; assert safe fallback, no broken button.
- [ ] Step 4: Test no-results search, Escape reset, course/specialty swap, empty course, long bilingual title, keyboard-only add-lecture route and browser Back/Forward.
- [ ] Step 5: Inspect touch target geometry and dark/light focus at 320/390/768/1024/1440, 200% zoom.
- [ ] Step 6: Verify printed and standalone offline navigation remain accessible.

### Task 4: Execute exact-head review and release-safety handoff

**Files:**
- Update: version.json, service-worker.js and src/pwa-client.js together if shell changes.
- Update: docs/project-autopilot/MEQ_REMEDIATION_MASTER_PLAN_2026-11-18.md execution checkpoint.

- [ ] Step 1: Run npm run quality:static and inspect all validators.
- [ ] Step 2: Run npm ci --no-audit --no-fund, npm run test:e2e and npm run test:webkit on identical source SHA.
- [ ] Step 3: Review full diff for clinical JSON, image, IDs, preference/schema changes; none allowed.
- [ ] Step 4: Re-capture before/after screenshots and log actual first-card y at both small widths, zoom and dark mode.
- [ ] Step 5: Open focused PR, require full Validate Medical MEQ Bank workflow, merge exact tested head only if green and reviewed.
- [ ] Step 6: Record source SHA, run links, merge SHA and status MERGED / NOT RELEASED. No automatic Cloudflare promotion.

**Acceptance:** First study action is reachable and real within first screen, existing four workspaces and draft authoring remain functional, ratings/exams/media unchanged, full exact-head static/Chromium/WebKit suite green. Production smoke is a separate release gate.
