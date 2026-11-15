# Reader Comfort — Phase D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make lecture explanations and original question text comfortably adjustable on phones and desktops without changing medical content, exam grading, or saved progress.

**Architecture:** Add a small native reading-size disclosure alongside the existing lecture mode tabs. Persist only a non-medical device preference in localStorage and expose it as a CSS custom property scoped to lecture prose. Retain the existing JS reader and Mineral Blue design.

**Tech Stack:** Vanilla JS/CSS, Playwright, existing build scripts.

**Spec:** `DESIGN.md` and the approved study-first recovery direction.

## Global Constraints
- Source and answer IDs, original JPEG bytes, clinical explanations and exam scoring are immutable.
- Never alter IndexedDB grade keys or saved exam sessions.
- Controls must remain keyboard accessible, at least 44px tall, and work at 320/390/768/1440px without horizontal document overflow.
- Standalone offline and PWA must use the same rendering path.
- No framework or external network dependency.

## Review Focus
- Reading-size preference survives reload but does not change progress backup.
- 320px tab strip remains usable when the size control is visible.
- MCQ labels and mixed Arabic/English paragraphs wrap at the larger size.
- Screen reader can distinguish size controls from lecture-reading tabs.
- No accidental change to print layout.

### Task 1 — Accessible size preference and control
- [ ] Add a Playwright test for missing reading-size disclosure and persisted larger font; observe RED.
- [ ] Add native reader-size controls to `src/app.js`, preserve existing tablist and mode behavior.
- [ ] Add scoped responsive typography rules to `src/app.css`.
- [ ] Verify targeted tests, keyboard and mobile no-overflow.
- [ ] Update PWA cohort in all version sources if required.

### Task 2 — Regression and release readiness
- [ ] Run full static, Chromium, and WebKit workflows; inspect exact SHA.
- [ ] Review diff for content/progress changes; no main merge on unverified evidence.
- [ ] Record verified status and remaining production blockers (#35, #50) without falsely claiming deployment.

## Decision
User has explicitly requested to continue and finish the development rather than re-discuss the design. This bounded increment keeps study use accessible while respecting safety gates. Later enhancements: chapter/source-review import and authenticated live verification.
