# My Medical Library V6 — Information Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement these checked tasks one PR at a time. Write failing regression checks before each code change; verify Chromium and WebKit before release. This plan is **PROPOSED** and does not itself authorize an app/data migration or production promotion.

**Goal:** Replace the current stacked-page study site with a calm, structured library and focused lecture/practice workspaces, while allowing future Chapter grouping and safer source-first authoring.

**Architecture:** Keep the existing offline-first vanilla JS app, course registry, lecture loader, medical JSON and persisted progress keys. Add a small hash-view router and reusable screen/reader components incrementally; preserve legacy render paths until verified replacements work. Optional chapter metadata must not alter lecture identity or published learning content.

**Tech Stack:** Existing static HTML/CSS/JS + Python stdlib validators + Playwright Chromium/WebKit + Cloudflare Workers build-only/manual promote.

**Spec:** \`docs/superpowers/specs/2026-11-05-my-medical-library-v6-information-architecture-design.md\`
**Visual tokens:** \`design-system/my-medical-library/MASTER.md\`

## Global Constraints

- Medical facts, source lecture JSON, original JPEG/AVIF figures and hashes, existing MCQ keys and exam grade semantics are immutable in a UI-only PR.
- Never change existing stable \`lecture.id\`, \`subjectKey\`, \`courseId\`, \`canonicalId\`, question IDs, localStorage/IndexedDB schema, source provenance or backup format.
- No unauthenticated browser-side GitHub credential and no auto-publication of unreviewed medical content.
- Preserve PWA offline support and print/export; show absent authored content as absent, never substitute generated questions or images.
- Each PR must pass exact-head static, Chromium, WebKit; Cloudflare preview is not production. Verify manual release/rollback and authenticated smoke after activation.

## Review Focus (cross-cutting)

1. **Legacy bookmarks/progress:** restoring a backup or opening a previously studied question preserves per-item ratings, exam attempts and selected lecture; tested in Tasks 2, 4, 5, 7.
2. **Absent content:** Surgery lecture without source MCQ, empty new specialty, image-only lecture and topic with long Arabic title must render useful states; tested in Tasks 3, 4, 6.
3. **Bilingual/RTL and small screens:** real Arabic+English content at 320/390px, 200% zoom, visible focus, no clipped labels or inaccessible drawer; tested in Tasks 4, 7.
4. **Bad source draft:** stale PDF SHA, duplicate IDs, ambiguous page references, unapproved media or orphan chapter must never publish; tested in Task 6.
5. **Offline/back:** opened lecture/deep link and focused question must work after PWA reload/back/forward; tested in Tasks 2, 4, 5, 7.

---

### Task 1 — Baseline and coherent tokens (no functional move yet)

**Files:** Review \`src/index.html\`, \`src/app.css\`, \`src/app.js\`; create \`src/styles/tokens.css\` only after confirming \`build.sh\` source dependency behavior; add \`tests/v6-shell.spec.js\`.
**Interface:** semantic colors/spacing/type tokens for all future screens; do not silently overwrite existing dark-mode tokens.
- [ ] RED: capture an assertion for one current shell state and visible component spacing/focus; verify the new token contract test fails before implementation.
- [ ] GREEN: centralize candidate Slate+Sage tokens in one source; wire build/import only after proving generated \`dist/app.css\` picks them up correctly.
- [ ] VERIFY: screenshot comparison 320/390/768/1440, available light/dark, static build. Do not claim a redesign at this stage.
- [ ] COMMIT: isolated tokens PR, reversible without any data change.

### Task 2 — App Router and distinct primary screens

**Files:** create \`src/view-router.js\`; modify \`src/index.html\`, \`src/app.js\` minimally; add \`tests/v6-navigation.spec.js\`.
**Interface:** \`parseViewHash(hash)\` returns safe screen identity + scope; \`navigateTo(view)\` updates URL and visible screen; \`restoreViewFromHistory()\` handles Back/Forward. Keep legacy selected course/lecture in existing registry as the source of truth.
- [ ] RED: test Home, Library, Lecture, Practice, Review and Exam views; deep-link reload, Back/Forward, invalid hash fallback and focus restoration.
- [ ] GREEN: expose one primary region per route with stable IDs/ARIA; hide inactive screens instead of appending every region to the study page. No unnecessary framework.
- [ ] VERIFY: no broken legacy exam or print buttons, no source content/answer modification, WebKit/Chromium keyboard traversal.
- [ ] COMMIT: functional navigation PR, existing reader still usable behind route.

### Task 3 — True Library hierarchy and optional Chapters

**Files:** update \`src/course-packs.template.js\`, \`src/lecture-loader.js\` as needed, \`courses/catalog.schema.json\` / \`courses/packs/*.json\` subject schema, \`lectures/catalog.schema.json\`, \`tools/lecture_builder.py\` validators; add \`tests/v6-library.spec.js\` plus Python schema tests.
**Interface:** optional \`subject.chapters?: {id:string,label:string,order:number}[]\`; optional \`lectureCatalogEntry.chapterId?: string\` must reference the same subject. No chapter introduced into persisted progress key or existing canonical ID.
- [ ] RED: test 3 existing courses/12 lectures with **no chapter fields** unchanged, plus valid chapter grouping, duplicate chapter ID, orphan \`chapterId\`, invalid order and no-lecture subject.
- [ ] GREEN: Course → Subject → optional Chapter → compact Lecture row; scoped search + source counts. A subject without chapters displays its lecture list directly.
- [ ] VERIFY: opening Bladder Cancer without source MCQs never shows MCQ exam entries; existing 138 reviewed MCQs still discoverable; rapid navigation with 100+ synthetic lecture metadata items.
- [ ] COMMIT: Library and schema PR; no medical lecture JSON changes.

### Task 4 — Dedicated Lecture Reader and Topic navigation

**Files:** incrementally adapt \`src/app.js\` \`renderLectureOverview\`, \`createStudyGuide\`, \`selectLecture\`, \`renderSubtopicNav\`; add \`src/lecture-workspace.js\` if isolated views are cleaner; reuse existing source figures; add \`tests/v6-lecture-reader.spec.js\`.
**Interface:** \`openLecture({lectureId,tab,topicId})\` exposes one authored tab (Read/Practice/Figures/Rapid). Desktop sticky topic outline, mobile accessible topic picker; Previous/Next topic and "Read all" opt-in.
- [ ] RED: assert selected lecture header + first content are in the initial viewport at 390×844 and 1440×900; hidden tabs when section absent; current topic/history preserved.
- [ ] GREEN: remove global hero/stats/filter stack from Lecture view; split only the relevant rendering responsibility, preserving text, images and source references byte-for-byte.
- [ ] VERIFY: actual Dermatology images, Psychiatry bilingual explanation, Urology legacy MEQ and topic navigation at 320/390/768/1440; test keyboard tabs per WAI APG and no extra online requests for offline data.
- [ ] COMMIT: reader PR; capture before/after screenshots.

### Task 5 — Focused Practice / Review / Exams

**Files:** wrap existing question and exam services behind focused view modules; adapt \`review-filter.js\`, \`src/app.js\`, \`src/print-manager.js\` only when needed; add \`tests/v6-practice.spec.js\`, \`tests/v6-review-exam.spec.js\`.
**Interface:** Practice shows one real authored item + controls, filters via sheet; Review is dedicated saved Weak/Review queue; Exam is uninterrupted start/attempt/result flow.
- [ ] RED: test study reveal does not auto-label Weak, Exam MCQ wrong answer auto-Weak, written answer still manual, saved mistake notebook/export/restore preserved.
- [ ] GREEN: remove full-question stacks from default Practice; preserve Random, per-type browsing, original figure viewer, exam timer/resume and Retry missed.
- [ ] VERIFY: 138 source MCQs present, no false MCQ scoring on lectures without keys; offline attempts, print and keyboard 1–4 intact.
- [ ] COMMIT: practice/review/exam PR without medical answer data edits.

### Task 6 — Safe Course/Subject/Chapter/Lecture intake wizard

**Files:** new \`src/library-manager.js\` and dedicated private view; reuse \`tools/new_lecture.py\`, \`tools/add_lecture.py\`, \`tools/lecture_review_report.py\`; optionally new Python metadata editor CLI; add \`tests/v6-intake.spec.js\` and Python authoring tests.
**Interface:** local-first wizard for Course > Subject > optional Chapter > Lecture; generates a reviewable canonical draft package with source provenance and consistent IDs. **No direct write to GitHub from the public static browser** without a separately authorized server-side integration.
- [ ] RED: test user can plan metadata without hand-editing catalogs, duplicate names/IDs/orders fail before download, and editor cannot mark source-review verified automatically.
- [ ] GREEN: authoring shell with validation and download/export; mark "Pending source review" until original PDF, figure/table coverage and explicit medical/editorial sign-off. Use existing hash verifier and registrar dry-run as publishing gate.
- [ ] VERIFY: import a synthetic new Course + Subject + Chapter + Lecture, run all validators, ensure no published files change in an unauthenticated/draft session and no original image hashes change.
- [ ] COMMIT: authoring workflow PR. Secure GitHub PR bridge is a separate future task if actually needed.

### Task 7 — Global Search, responsive craft and release readiness

**Files:** enhance \`search-optimization.js\`, \`src/app.css\`/future style slices, \`tests/layout.spec.js\`, \`tests/accessibility.spec.js\`, \`tests/webkit-smoke.spec.js\`, \`tests/pwa-release-integrity.spec.js\` and new screenshot snapshots.
- [ ] RED: no 320px horizontal overflow, search deep links into an exact scoped lecture/question, correct focus/screen reader semantics, 200% zoom and long Arabic+English titles.
- [ ] GREEN: consolidate obsolete CSS overrides as each panel migrates; ensure one-token definition rather than cascade hacks; preserve accessible dark mode and reduced motion.
- [ ] VERIFY: \`npm run quality:static\`, \`npm run test:e2e\`, \`npm run test:webkit\`, offline, backup/restore, original-figure SHA, Print/PDF, mobile/desktop, no clinical content drift.
- [ ] COMMIT: final design polish PR, no production deployment automatically.

### Task 8 — Controlled release and post-release evidence

**Files:** update \`DESIGN.md\`, \`PROJECT_PROGRESS.md\` / \`docs/project-autopilot/PROJECT_STATUS.md\`, \`version.json\`, PWA version references only when releasing, exact release screenshot record.
- [ ] Confirm the latest protected \`main\` exact-head validate, Chromium, WebKit and Workers Builds checks all pass; manual reviewer of UI and source preservation signs off.
- [ ] Upload version via build-only Cloudflare setting; preserve prior known-good Worker Version ID and user progress.
- [ ] Use approved production workflow; check active 100% Worker version and site through authorized Cloudflare Access login; do not weaken Access just to pass smoke.
- [ ] Record real deployed SHA/Worker version, before/after screenshot, smoke result, defects, rollback readiness and any remaining source-content review exceptions.

## Implementation sequence / grouping

**UX-01:** tokens+router; **UX-02:** library/chapter hierarchy; **UX-03:** reader; **UX-04:** practice/review/exam; **UX-05:** local-first intake; **UX-06:** search/polish; **UX-07:** protected release. Each can be a separate reviewed PR with CI and reversible rollout. Prioritize UX-01→UX-03 to eliminate the long-page problem before expanding the authoring system.

## Exit criteria

No named V6 phase is complete until its tests and screenshots are checked at the exact commit, the mandatory medical/progress invariants remain true, and its product behavior is navigable without the old long-scroll stack. This document is a plan only: zero implementation tasks are marked done.
