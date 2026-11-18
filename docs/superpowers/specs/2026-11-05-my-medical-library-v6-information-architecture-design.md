# My Medical Library V6 — Information Architecture and UX Redesign Proposal

**Status:** PROPOSED — design/review only, NOT implemented or deployed.
**Prepared:** 2026-11-05. **Reviewed code:** main commit \`cb0d193c447623b5b52784ab6d5e73d4275f400e\`.
**Product:** A personal, lecture-first, offline-capable medical learning library. Medical source content is authoritative; a redesign must not invent facts, answer keys, new exams, source images, or medical guidance.

## Executive decision

Move from a single vertically stacked, all-purpose dashboard to a **library-first, task-focused study workspace** with distinct Home, Library, Lecture, Practice, Review, Exam and private Content Manager surfaces. Use routing/view state instead of stacking all surfaces in the same scrolling column. Keep the existing proven source and progress systems.

### Evidence and confidence boundaries

- Inspected repository source: \`src/index.html\`, \`src/app.js\`, \`src/app.css\`, \`src/course-packs.template.js\`, course packs, the lecture catalog and authoring tools.
- Inspected **22 rendered screenshots** from the main-branch Chromium Playwright report, [run #42007867391](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42007867391), spanning 320, 390, 768, 1280 and 1440 CSS-pixel viewports. These are automated test captures, not an independent logged-in visit to the production Worker.
- Independent external browser access to Cloudflare Worker was blocked; do not claim direct production walkthrough. Authenticated production smoke remains blocked by Cloudflare Access Service Auth (HTTP 302). Browser tests for the reviewed main commit did pass.
- \`src/index.html\` contains hero, course drawer, review drawer, breadcrumbs, multi-select toolbar, analytics, lecture/topic sidebar toggles and then the content \`<main>\` in one document. On the 390x844 screenshot, the learner reaches a lecture header only near the bottom of the initial viewport.
- \`src/app.css\` is ~132 KB with ~93 \`@media\` blocks and 4 \`:root\` blocks; \`src/app.js\` is ~85 KB. This is a maintainability risk and signals repeated layered UI overrides, not proof of a runtime bug.
- Source catalog contains **3 courses**, **12 published lectures** (9 Surgery, 3 Internal Medicine II), and **138 source-linked MCQs** across 3 lectures. Some specialties and courses have zero published lectures. Empty and partial content is a normal state.
- Current hierarchy is Course > Specialty/Subject > Lecture > Subtopic. **There is no Chapter data entity**. Adding a new course/lecture primarily uses command-line tools, draft JSON, review checklists and source integrity validation.

## Goals / anti-goals

**Goals:** quickly find a subject/chapter/lecture; start reading above the fold; one dedicated reading surface; one-question-at-a-time practice; clear return path; allow optional chapter grouping; reduce authoring metadata friction; support source-authenticated content review; maintain excellent mobile and offline experience.

**Non-goals:** update clinical facts; generate substitute medical imagery; manufacture MCQ keys; rewrite source lecture IDs; migrate or wipe stored learner progress; turn the single-user app into a multi-tenant CMS; rewrite vanilla JS into React just to adopt a component library; publish unreviewed PDFs.

**Anti-goals:** giant promotional hero; unrelated statistics between navigation and reading; nesting card-in-card everywhere; scroll-triggered entertainment effects; a dozen controls before the first exam question; deep folder trees requiring many clicks; publishing directly from an unauthenticated static page.

## Approaches considered

A. **CSS-only facelift:** quick but leaves the core single-scroll information architecture and command-line authoring friction unresolved. Rejected.
B. **Whole-app rewrite in React/Next:** powerful component ecosystem but increases migration risk to existing PWA cache, offline behavior, source integrity and browser-local progress. Rejected now; reconsider only with measured maintainability needs.
C. **Progressive screen-based redesign on the existing vanilla JS PWA** (recommended): introduce a small hash router, reusable view shells and semantic tokens, preserve validators/storage contracts, and migrate one surface at a time with Chromium/WebKit gates. This is a proposal, not an approved final implementation yet.

## New information architecture

\`\`\`text
MY MEDICAL LIBRARY
├─ Home                  daily entry point: Continue, Recent, Weak, quick exam
├─ Library               browse/search published learning structure
│  ├─ Course             Surgery | Internal Medicine | Internal Medicine II
│  │  └─ Subject         Urology | Psychiatry | Dermatology | ...
│  │     └─ Chapter?     optional grouping, skipped if absent
│  │        └─ Lecture   named content unit; stable existing lecture ID
│  │           └─ Topic  existing lecture subtopics
│  └─ Global Search      search subject, chapter, lecture, topic, source MCQ
├─ Practice              per-question study, across selected scopes
├─ Review                Weak, Review, mistake notebook, history/progress
├─ Exams                 exam settings, live session, results, retry
└─ Manage Library        private author-only metadata/intake wizard
\`\`\`

**Vocabulary:** Course = curriculum block; Subject/Specialty = discipline; Chapter = optional grouping of multiple lectures within a subject; Lecture = source-bound published unit; Topic = subsection within one lecture. *No duplicate Chapter and Topic node for the same concept.* If no chapters are authored, display subject > lectures directly.

**Optional chapter schema proposal:** add \`chapters: [{id,label,order}]\` to the relevant subject in its \`courses/packs/*.json\`, and \`chapterId?: string\` to lecture catalog records. The \`chapterId\` links metadata only; never change existing \`id\`, \`courseId\`, \`subjectKey\`, \`canonicalId\`, progress item IDs or answer keys. Existing lectures remain valid and appear directly under their subject if unassigned. Update schema validators and regression fixtures **before** adding data.

**Deep-link proposal:** hash-based paths so existing static Worker/PWA routing continues working, e.g. \`#/library\`, \`#/course/surgery\`, \`#/subject/surgery/urology\`, \`#/lecture/urology-bladder-cancer?tab=read&topic=...\`, \`#/practice?scope=...\`, \`#/review\`, \`#/exams\`. Browser Back must restore location; preserve focus and previous scroll when returning from a lecture.

## Screen-by-screen design contract

### 1) Home: Today, not a marketing landing page

- Slim masthead/brand; primary nav; one real **Continue studying** action from saved progress.
- A small **Recent lectures** row and **Review next** queue; an optional Exam action in context.
- Course picker as secondary discovery, not a large permanent hero. Stats and backup/settings accessible by one control but don't push the reader down the page.
- First use: explain "Choose a course → a lecture → Read or Practice." No fake activity/progress.

### 2) Library > Course / Subject / Chapter

- Desktop: stable 220–256px course/subject rail; central searchable lecture list; content preview/summary only when selected. Mobile: a dedicated Library screen with search and compact rows (no stacked dashboard).
- At subject level, display optional chapter groups (with counts) and the lecture index; when no chapters, use a flat lecture list with sorting and search.
- Each lecture row: order, title, available source sections, real progress, last visited; single click opens reader. Show absent content as absent, not fake "0 MCQs" exam shortcuts.
- Progress and syllabus grouping are secondary metadata. Do not show every topic of every lecture in the same list.

### 3) Lecture Workspace: read content immediately

- Compact breadcrumb, lecture title, previous/next lecture, progress and source citation.
- **One active mode at a time**: Read | Practice | Figures | Rapid/Recap (only authored modes shown). Detailed Written/MEQ access is a clear Practice subtype. Optional embedded print action remains under More.
- Read mode: left main article (max text measure 68–75ch); right sticky **This lecture** topic outline on desktop; on mobile the topic outline becomes a sheet/picker.
- Selecting a topic shows that topic's content by default, with Previous/Next Topic and "Read all topics" opt-in. Do not dump the full lecture + all questions + all figures into one scroll.
- Exact original photo crops and SHA provenance stay unchanged; native zoom/gallery provides full image and caption without generating substitutes.
- Keep explicit \`Understanding Aid — Not an additional exam fact\` labeling when existing authored content uses it.

### 4) Practice: focus on one question

- Question type and scope filters live in an optional filter sheet, not the persistent reader header.
- Default one question at a time, clear question index, Previous/Next, reveal when permitted, answer/source link, Mastered/Review/Weak actions.
- Exam MCQ auto-grading remains **only in Exam mode** and only for source-validated keys; ordinary study reveal never automatically sets Weak.
- For written/clinical/image questions, retain manual self-assessment. Keep shuffle/random behavior but ensure Back and resume work.

### 5) Review / Insights

- Review queue focused on Weak + Review, Daily Weak 15, mistake notebook and completed exam attempts.
- Stats and deeper breakdowns are a separate subview, **not a whole-screen obstacle before every lecture**.
- Existing rating semantics, IndexedDB, backup preview, offline state and conflict handling remain unchanged.

### 6) Exams

- Dedicated distraction-free screen with genuine exam setup, resume, numbered question navigation, timer where chosen, final results and retry missed.
- Keep separate MCQ automatic accuracy and manually assessed written-question results. No accidental reveal of answers while attempting a scored question.

### 7) Global Search

- Search course, subject, optional chapter, lecture title and authored question text, with explicit result type/source and filters.
- Scope selector for All Library vs Current Subject; search results open exact lecture/topic/question in the correct view. No giant "all matching full content" page.
- Existing on-demand lecture loading and offline fallback must continue working.

### 8) Manage Library: safe authoring, separate from study

- Personal **author-only** area, not visible as a study widget: create/edit course metadata, subject, optional chapter and lecture draft.
- Guided intake: Choose Course > Subject > optional Chapter > Source PDF or document > Draft Content > Check pages/images/tables > Medical/editorial sign-off > Dry-run > PR/Publish.
- Step states: Draft; Needs source review; Ready for editorial review; Approved; Validated; Released; Rejected. Wording must distinguish review assertion from proven medical correctness.
- Initial safe version may generate/export reviewed metadata/JSON packages locally and use the existing \`new_lecture.py\`, \`lecture_review_report.py\` and \`add_lecture.py\` validators. Do NOT pretend a static browser alone can securely write to GitHub or upload private PDFs. A later authenticated server-side Worker/GitHub PR bridge needs separate scoped credentials and review.
- Prevent duplicate ID/order/title, orphan chapters, invalid PDF page claims, missing assets, and stale report hashes. Always preserve original medical source. Adding a chapter must not rewrite previously saved progress.

## Information density, responsive behavior, and semantics

**Desktop >= 1200:** left compact nav + one primary work area + optional contextual outline. Do not leave blank dashboard panels occupying the first viewport.
**Tablet 768–1199:** collapsible rail, one main area, topic drawer.
**Phone <= 767:** single-task screen, minimal top bar, 4–5 primary destinations maximum, context switcher for Course/Subject/Lecture, bottom/overflow actions appropriate to device. A selected lecture title and first real content should appear within the first viewport of the Lecture screen.
**Reading:** minimum usable 16px body, 1.55–1.8 English line height, generous Arabic line spacing, code-safe LTR spans and real RTL support.
**Accessibility:** native elements first; use W3C APG tabs if using tabs (tablist/tab/tabpanel, keyboard arrow/home/end), visible focus, clear loading/empty/error states, touch targets near 44 CSS px, reduced motion; test 200% zoom and 320px screens.

## Visual design direction (proposed)

**Working name:** Slate + Sage Reading Studio. Calm, precise, book-like but operational.
- Canvas \`#F6F8F7\`; panels \`#FFFFFF\`; primary text \`#182A32\`; supporting text \`#587079\`; border \`#DCE6E4\`.
- Primary action \`#1C6765\` / hover \`#12504E\`; selection surface \`#E5F3F0\`. Distinct status red/amber/green remain semantic.
- Verified contrast ratios: white on primary approx 6.61:1; ink on canvas 13.90:1; muted on canvas 4.91:1. Validate actual disabled text and overlays too.
- No saturated hero gradient, giant KPI cards, repetitive card-in-card shadows, decorative illustrations, or UI libraries that require a framework rewrite.
- English: Inter/system sans; Arabic: Cairo or carefully tested local fallback if licensed/packaged offline. Theme must remain usable with OS fonts if an optional font does not load.
- 8px spacing rhythm, 12–16px radii for panels, subtle borders, one elevated control surface per hierarchy, low-motion transitions, deliberate icon set.

## Implementation strategy and data safety

- Reuse existing \`src/app.js\` study and rating logic behind a new view/router facade; do not copy or rewrite it wholesale in one PR.
- Preserve \`MEQCourseRegistry\`, \`MEQLectureLoader\`, \`lectures/catalog.json\`, all five legacy question arrays, source MCQs, source figures, exam engine, IndexedDB/localStorage keys, backup semantics and service worker versioning.
- Keep app vanilla HTML/CSS/JS initially. Design tokens in dedicated CSS and small reusable view modules; modify \`build.sh\` only after auditing the injection pipeline and source parity.
- Roll out one task-focused screen at a time behind reversible view navigation; keep source and published screenshots comparable until usability tests pass. Do not merge UI and medical-content edits in the same PR.

## Release acceptance metrics (targets, not measurements yet)

1. Home > chosen lecture opens reading within **3 deliberate user actions**; the lecture's title and content begin within the first viewport after navigation on phone and desktop.
2. Subject lists remain usable with **100+ lectures**; searching/filtering returns a compact list rather than appending full question bodies.
3. No unintentional horizontal overflow at 320, 390, 768, 1024 and 1440px; keyboard-only complete journey; 200% text zoom; dark and light states.
4. Optional Chapters do not break any existing lecture, source image, MCQ/exam grading, IndexedDB progress, backup/restore or offline retrieval.
5. Every exposed authoring action either safely creates local draft evidence, validates an explicit reviewed source or clearly reports missing permissions. Never allow one-click unreviewed medical publication.
6. Static validators, Chromium/axe/print/offline and desktop+iPhone WebKit suites pass at the exact release head; capture independent authenticated production smoke after manual promotion.

## Skill and design-library policy

Already **installed and used this review:** Project Autopilot, Impeccable, UI/UX Pro Max, Frontend Design, Web Interface Guidelines, Playwright workflow. These are ChatGPT skills, not project npm dependencies.
**Reference systems to consult, not yet installed:** Open Props (CSS token ideas), Radix Colors (accessible palette construction), Lucide (consistent SVG icons), W3C ARIA Authoring Practices (tabs/landmarks). The existing vanilla-JS project does not benefit from a compulsory React/shadcn or Tailwind migration merely to copy a design aesthetic.
**Limit:** No tool in the current ChatGPT skill connector allows autonomously installing new ChatGPT-web skills; registering source references or adding npm packages is not equivalent to installing a ChatGPT skill.

## Review gate

This document is a design recommendation for the owner to review. No V6 visual UI, Chapter schema, admin publishing API or production deployment is claimed as implemented. See implementation plan and roadmap for separately testable steps.
