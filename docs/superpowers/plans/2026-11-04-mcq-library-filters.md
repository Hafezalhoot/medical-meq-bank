# LIB-02 · First-Class Source MCQs — V5.5 Implementation Plan

> **For agentic workers:** Use `executing-plans` and `test-driven-development` to implement task-by-task; preserve the library's medical-source boundary.

**Goal:** Turn reviewed lecture MCQs into first-class searchable, filterable, revisable question cards within My Medical Library, including an on-demand, across-lecture MCQ view in the active specialty.

**Architecture:** Reuse the existing `createStudyGuide()` MCQ renderer, canonical `key(...,'mcq',...)` status store, `MEQLectureLoader.loadLecture`, and the already authoritative `review-filter.js` filter pipeline. Add optional `mcqCount` to the metadata-only lecture catalog and verify it against the loaded source payload. The regular landing page remains lazy; only selecting `MCQ practice` with `All lectures` requests the additional source payloads in that specialty. No new database, dependency, scoring key or fact generation.

**Tech Stack:** Vanilla JS, HTML, CSS, Python static validators, Playwright, GitHub Actions.

**Spec:** [Issue #77](https://github.com/Hafezalhoot/medical-meq-bank/issues/77) and approved personal-library roadmap #74. Branch is stacked on [V5.4 PR #76](https://github.com/Hafezalhoot/medical-meq-bank/pull/76).

## Global constraints
- Lecture-First Policy: preserve all authored question IDs, question text, options, answer indices, rationale and source-page labels.
- Never interpret a not-yet-answered source MCQ as wrong or auto-rate it Weak. Self-rated Mastered/Review/Weak and automatically graded exam accuracy stay separate.
- Do not change `medicalBankStatusV2`, IndexedDB, backups, restore or exam-mode behavior.
- Accessible keyboard/radio/reveal flow; 320px/390px/768px/1440px, dark mode and reduced motion; never create an empty/misleading source section.
- Do not merge/deploy before parent PRs #75/#76 and Cloudflare release controls #35/#50.

## Review focus
1. A legacy lecture with no `studyGuide.mcqs` must display no MCQ cards or fabricated stats.
2. Metadata `mcqCount` must match actual reviewed source payload upon load; stale counts fail rather than silently lie.
3. The MCQ-only filter must work with search and saved review status, but topic/priority filters lacking author metadata cannot exclude everything silently.
4. A subject-level MCQ view must load only explicitly selected subject lectures, not all courses by default; searches include question/options/rationale and source page.
5. Quiz answer feedback must not mutate self-rated progress unless the learner explicitly rates an item; opening another lecture and restoring must preserve ratings.

## Task 1 — Repro tests (RED)
**Create:** `tests/library-mcq-discovery.spec.js`.
- Dermatology has exactly 30 MCQ cards when type filter is `mcq`, source references, rating labels, and answer feedback, with search narrowing to one.
- Psychiatric `All lecture overviews` + MCQ filter can find all 108 reviewed MCQs across two lectures (52+56) and search a known question.
- Urology Bladder Cancer has no MCQ results and a useful empty state; existing Cases view remains.
- Unanswered MCQ remains unrated after viewing/revealing. Explicit Weak persists to review filter and reload.
- 390px mobile filter sheet shows only matching questions and no page overflow.
**Run:** full CI as the current Actions workflow is the available execution environment. Confirm failures on missing MCQ filter and overview before implementation.

## Task 2 — Metadata integrity
**Modify:** `lectures/catalog.schema.json`, `lectures/catalog.json`, `src/lecture-loader.js` and optional validators if needed.
- Add optional top-level `mcqCount` to a catalog entry (not to protected legacy `expectedCounts`): 30 Dermatology, 52 Psychiatric history, 56 Anxiety.
- Verify declared count against loaded `studyGuide.mcqs.length`, propagate metadata `mcqCount` on lazy lecture stubs.

## Task 3 — Search, filters and question UI
**Modify:** `src/app.js`, `review-filter.js`, `src/index.html`, narrowly `src/app.css` if necessary.
- A source MCQ is a `study-item` with canonical lecture/type search metadata; never change questions, IDs, scoring or progress keys.
- MCQ-only mode shows and opens authored source MCQ disclosure; hide other nonquestion guide sections and legacy question types.
- Review status and search work on MCQs using existing `review-filter.js`, respecting no topic/priority assignment (disable inapplicable controls and restore).
- Select MCQ from All lectures in a specialty to browse source MCQs across lecture payloads loaded *on demand*, with no duplicate cards and no foreign-specialty fetches.
- Show MCQ count per lecture in overview, MCQ metric and clear label for legacy written-rating progress.
- Clear/empty states and random/reveal actions should not be misleading.

## Task 4 — Verify
- Run exact-head Static/Content, full Chromium, WebKit and Workers build as available.
- Compare protected source hashes, answer keys, progress schemas, unrelated files and dependency inventory.
- Update PR and #77 status with exact tested SHA. Keep stacked branch unmerged, not production deployed.
