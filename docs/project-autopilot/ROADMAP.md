# My Medical Library — V6 UX Redesign Roadmap

**State:** Proposed design, implementation NOT started. Branch \`design/my-medical-library-v6-ux-blueprint-20261105\`; latest reviewed app source \`cb0d193c447623b5b52784ab6d5e73d4275f400e\`.
**Spec:** [V6 Information Architecture](../superpowers/specs/2026-11-05-my-medical-library-v6-information-architecture-design.md) · **Tokens:** [V6 Design System](../../design-system/my-medical-library/MASTER.md) · **Step-by-step plan:** [Implementation](../superpowers/plans/2026-11-05-my-medical-library-v6-execution.md)

## Priority findings

| ID | Priority | Evidence | Problem | Next step | State |
|---|---|---|---|---|---|
| UX-IA-01 | P1 | \`src/index.html\`: hero → library/review → filters/stats → two sidebars → main; 390px CI screenshot | Core reading is below several unrelated panels | Separate screens and views | Open |
| UX-NAV-02 | P1 | \`src/app.js\`: lecture filter, lecture nav, topic filter, topic nav, content render | Multiple redundant navigation mechanisms | Consistent course/subject/lecture/topic pathway | Open |
| UX-READ-03 | P1 | Rendered Chromium desktop/mobile captures | Dense source explanation competes with global controls | Focused Lecture / Read workspace | Open |
| UX-ADMIN-04 | P1 | \`tools/new_lecture.py\`, \`tools/add_lecture.py\`, \`CONTENT_AUTHORING.md\` | Adding a course or lecture requires JSON/CLI workflow; no authoring screen | Local-first authoring wizard + validators | Open |
| UX-CHAP-05 | P2 | \`courses/packs/*.json\`, \`lectures/catalog.json\` | No chapter entity; only Course→Subject→Lecture→Subtopic | Optional backward-compatible chapter metadata | Open |
| UX-CSS-06 | P2 | \`src/app.css\` ~132 KB/93 media blocks; \`src/app.js\` ~85 KB | Styling and rendering concentrated in large files | Token consolidation + focused view modules | Open |
| UX-SCALE-07 | P2 | \`renderMcqOverview\`, \`applyFilters\` scans \`.study-item\` DOM | Long lists and expanded source question content risk scaling friction | Default one-question Practice; compact search results | Open |
| UX-A11Y-08 | P2 | Current screenshots, WAI APG / UI Guidelines | New tab/rail/sheet behavior requires explicit keyboard/RTL testing | Native semantics + Playwright coverage | Open |
| UX-VISUAL-09 | P3 | 22 screenshots in GitHub Chromium artifact run #42007867391 | Current brand is clean but uses excessive layered containers/empty space | Proposed Slate+Sage reading studio | Open |

Severity is design judgment grounded in source/screenshots; an independently authenticated production interaction audit is still outstanding.

## Delivery slices / gates

| Slice | Deliverable | Dependency | Acceptance gate | State |
|---|---|---|---|---|
| UX-01 | Tokens, compact shell, deep-link router | Design approval | Source/static + browser/Back + no data changes | Planned |
| UX-02 | Library, specialty, optional chapters, scalable lecture list | UX-01 | Current 12 lectures unchanged; missing/invalid chapters validated | Planned |
| UX-03 | Separate Lecture Reader + responsive Topic index | UX-02 | Title/content above fold; source images and bilingual text verified | Planned |
| UX-04 | One-item Practice, Review and Exam workspaces | UX-03 | Existing MCQ scoring, Weak/Review, exams, backups unchanged | Planned |
| UX-05 | Course/Subject/Chapter/Lecture local-first intake | UX-02 & V5.9 review tooling | New synthetic draft; validators; no unapproved publication | Planned |
| UX-06 | Search and responsive/a11y visual hardening | UX-03/04/05 | 320/390/768/1024/1440, 200% zoom, keyboard, offline, WebKit | Planned |
| UX-07 | Protected production rollout | All prior slices | exact-head CI, immutable Worker upload, manual promotion, authenticated smoke | Planned |

**Owner approval required before implementation** of this proposed redesign. This documentation branch changes no runtime app, medical-content files, persistent learner data or production Worker. Code changes belong in separate reviewed feature PRs.

## First implementation candidate

UX-01 **navigation-only slice**: add Home/Library/Lecture/Practice/Review/Exam views and stateful hash URLs while preserving current question/study implementations. The first visible measure of success is that choosing an existing lecture opens the lecture screen directly instead of returning to the top of the global dashboard.

## Protect in every slice

- Lecture-first source and exact original image/provenance.
- Existing \`id\`, \`canonicalId\`, item progress keys, offline cache versioning and safe backup/restore.
- Source-verified MCQ auto-scoring only in Exam mode.
- Manual grading of written/image questions.
- Every existing published lecture and optional content type; hide missing types gracefully.
- No bypass of current protected main/Cloudflare release controls.
