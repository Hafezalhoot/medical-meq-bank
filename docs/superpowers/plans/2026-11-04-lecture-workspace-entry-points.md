# Lecture Workspace Entry Points — V5.4 Implementation Plan

> **For agentic workers:** Use the installed executing-plans and test-driven-development skills. Apply this plan one checkable task at a time; do not merge or deploy until the release gates are satisfied.

**Goal:** In My Medical Library, make source-based Explanation, MCQ Practice and original lecture figures independently discoverable and accessible from the current lecture, with an obvious return path to the lecture list.

**Architecture:** Extend the existing `createStudyGuide()` disclosure renderer and `render()` in `src/app.js`. Reuse native `<details><summary>` sections and existing `selectLecture('all')`; no route rewrite, no new dependencies, no changes to stored keys or source lecture JSON.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Playwright; build via existing Python scripts and GitHub Actions.

**Spec:** GitHub issue #74, LIB-01 / LIB-02. Previous foundation PR #75 (tested head `50ef65e26cdb1a4bf773848596a86fb205635e21`).

## Global constraints
- Lecture-First medical facts; show only existing authored content and original source figures.
- No editing `lectures/`, `courses/`, identifiers, exam scoring, source-image hashes, progress storage or backups.
- Keep course/subject/lecture lazy loading and legacy MEQ/short/image/rapid content intact.
- Preserve accessible keyboard focus; 44px touch targets; 320px no page-level horizontal overflow; right-to-left paragraphs unchanged.
- This is a **stacked PR** targeting the #75 feature branch. `main` and Cloudflare must remain unchanged pending issues #35 and #50.

## Review focus
1. Study Guide section absent: no fake Explanation or MCQ shortcut.
2. Lecture with only original source figures: show Original Figures only (not an invented Explanation shortcut).
3. Repeated navigation: opening another section should preserve source contents and focus visible summary.
4. Overview back path: shown only when there are 2+ lectures; keeps selected course/subject and rated progress.
5. Mobile 320/390px: non-overflowing reader section navigation, accessible keyboard focus and existing question filters.

## Task 1 — Tests first
**Test:** `tests/lecture-workspace-navigation.spec.js`
- Open Internal Medicine II/Dermatology from existing course controls. Expect separate *Explanation*, *MCQ practice*, and *Original lecture figures* shortcuts in `nav[aria-label="Lecture sections"]`.
- Click each shortcut; its corresponding `details` opens, visible section summary receives focus, MCQ options remain available. Check 390px with no page-level overflow.
- Open existing legacy Urology/Bladder Cancer. No false Explanation/MCQ shortcuts; legacy Cases button works.
- For 2+ lectures, click *All lectures*; overview heading/cards show and lecture count/status persist.
- Run red before changing production code; confirm failure because shortcuts/overview-back control are absent.

## Task 2 — Implement only after meaningful red
**Files:** `src/app.js`, and minimally `src/app.css` if new controls need layout.
- Assign stable, lecture-local identifiers to authored `studyGuide` details sections.
- Build one shortcut per **actually rendered** explanation/MCQ/Infographic/original figure detail, with `aria-controls` referring to that detail; open exactly the targeted detail and focus its summary.
- Replace ambiguous combined source-guide button; preserve preexisting Cases/Shorts/Images/Show all/Offline actions.
- Add *All lectures* button to the lecture header only when the current specialty has multiple lectures; use existing `selectLecture('all',false)` and focus overview heading.
- Keep CSS scoped, mobile horizontal scroll and print suppression.

## Task 3 — Verify and checkpoint
- Exact-head Static/Content validation, complete Chromium/axe/print/offline and WebKit on GitHub Actions.
- Inspect PR diff for forbidden data/storage changes and review screenshots available from test reports; do not claim visual QA without rendered evidence.
- Update `docs/project-autopilot/PROJECT_STATUS.md` and issue #74 with tested commit SHA, results and remaining blockers.
- Keep branch/PR unmerged while Cloudflare Access #35 and deployment-promotion #50 remain unresolved.
