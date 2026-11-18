# My Medical Library — Master Repair & Development Roadmap

> For agentic workers: REQUIRED SUB-SKILL: use executing-plans / test-driven-development for each independent slice. Every checkbox remains uncompleted until evidence is recorded.

**Goal:** deliver a calm and fast personal medical-study application by fixing the confirmed UX/product gaps while preserving lecture science, original figures, saved learning state and protected release flow.

**Architecture:** small independently reviewable patches to current vanilla JS/CSS and source JSON; the reader, practice, source validation and release gates remain single sources of truth.

**Tech Stack:** HTML/CSS/JS, Python content validators, Playwright Chromium/WebKit, PWA/Cloudflare Workers, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-11-18-meq-study-first-recovery-design.md; supporting: AGENTS.md, DESIGN.md, CONTENT_AUTHORING.md.

## Current verified baseline — 2026-11-18

- Main SHA ca6e39a3c87c5822a83d72f648b4be9d033351ae, version 2026.11.15.2.
- Three registered materials; published lectures in two (Surgery 9, Internal Medicine II 3), total 12.
- 138 reviewed MCQs in three lectures (30 Dermatology, 52 Psychiatric History, 56 Anxiety Disorders). Nine lectures have source-backed cases/shorts/images/rapid but do not have the same authored Explanation+MCQ.
- 109 image-question references resolved in the inspected artifact; 51 declared SHA hashes matched, 58 without explicit hash metadata. No absent media detected in that artifact.
- UX audit score 11/20, from a built offline preview and source inspection, not a production score.
- At 320x700 Library first card y≈651; at 390x844 y≈627. Reader Dermatology MCQ tab stacks 30 questions and produces a ~18,837px page on 320px.
- GitHub PR #102 exact-head tests reported 280 passing Chromium, 54 passing WebKit, two intentional skips. Source CI is not proof of live production.
- Production Cloudflare Access and upload/promotion questions #35/#50 are unresolved in evidence; no authenticated live Worker version, traffic, or rollback verification.
- PDF Manage Library wizard currently creates an unpublished intake draft, NOT automatically validated PDF-based medical content.

## Tracking rule

Status vocabulary: NOT STARTED | IN PROGRESS | TESTED / UNMERGED | MERGED / NOT RELEASED | VERIFIED IN PRODUCTION | BLOCKED(reason).
Never mark a work item DONE on a documentation PR or merely because an existing capability is present.
One PR per coherent, testable vertical slice; record exact tested head SHA, build run, merged SHA, evidence and active Worker ID if verified.

## Execution lanes, priorities and dependencies

| ID | Priority | Deliverable | Dependencies | Initial status |
| --- | --- | --- | --- | --- |
| G0 | P0 | preserve 12 lecture payloads, 138 keys, original images, ratings, unfinished exams, offline parity | none | NOT STARTED (existing tests are available) |
| G1 | P0 release gate | verify Cloudflare build-only upload, restricted Access service auth, manual promote and rollback | Cloudflare owner rights, #35 #50 | BLOCKED(owner configuration) |
| U1 | P1 | first-screen Library and Continue without stacked mobile chrome | G0 baseline | NOT STARTED |
| U2 | P1 | one-MCQ-at-a-time Reader + Practice navigation, Browse all optional | G0; can follow U1 | NOT STARTED |
| C1 | P1 | truthful published-section availability labels and empty states | G0; independent of G1 | NOT STARTED |
| C2 | P1 | 58 missing image hash/provenance records and figure text review | original sources | BLOCKED(source review when source unavailable) |
| A1 | P1 | one full original PDF → inventory → reviewed lecture → validated PR pilot | C1 + source file/editorial approval | BLOCKED(pilot source/editorial review) |
| A2 | P2 | faster Material/Specialty/Chapter administration with safe private drafts | A1 decision, current importer | NOT STARTED |
| Q1 | P1/P2 | dark contrast, 44px targets, RTL, zoom, focus/print | U1/U2, sampled evidence | NOT STARTED |
| Q2 | P2 | CSS/JS simplification and measured offline performance | visual baseline snapshots | NOT STARTED |
| Q3 | P1/P2 | visible device-local backup/restore guarantees | G0 | NOT STARTED |
| R1 | P0 release gate | exact-head CI, Cloudflare Worker version/traffic and authenticated production smoke | G1 and critical P1 closed | BLOCKED |

**Ordering:** begin G0 and U1 immediately. Execute U2, C1, Q3 as small releases. Handle C2/A1 as soon as verified original PDFs are available; G1 in a separate infrastructure lane. Finish Q1/Q2, then R1. Do not stall source UX development solely because production Access cannot yet be verified.

## Slice G0 — preservation and deployment evidence

- [ ] Verify tests/study-preservation.spec.js and its frozen baseline, lecture source/dist parity, source media fingerprints, backup and exam-session persistence on the current branch.
- [ ] Require UI PR diff to leave lectures/data, original media, IDs and MCQ answerIndex untouched.
- [ ] Snapshot main source SHA, version cohort, relevant test execution and offline parity before each feature branch.
- [ ] Record G1 separately: whether Cloudflare uses wrangler versions upload rather than deploy-on-push; verify least-privilege MEQ_CF_ACCESS_CLIENT_ID/SECRET without revealing values; capture previous Worker UUID for rollback.
- [ ] Read /version.json under approved Access credentials and verify Worker ID and 100% traffic after authorized promotion, then authenticated browser smoke. Do not claim production readiness before this.

## Slice U1 — Library: first useful study action

Expected source: src/index.html, src/app.css, optionally src/app.js and src/study-position.js. Test: tests/library-first-screen.spec.js plus tests/v6-workspace.spec.js.

- [ ] Write failing 320x700 first-card y<=430 regression; record baseline before any CSS changes.
- [ ] Remove duplicate mobile location headings and excess whitespace; keep all course/specialty/chapter controls reachable with labeled keyboard navigation.
- [ ] Display #continueLastStudyCard when valid, or first lecture card when fresh; do not reserve empty space when absent.
- [ ] Keep #libraryLectureSearch, #libraryAddLectureLink, #courseSelector and #subjectSelector functional, including no-results and subject switching.
- [ ] Verify 320/390/768/1024/1440, 200% zoom, dark/light, keyboard focus, long bilingual names, no horizontal scroll, and correct Back/Forward.

**Acceptance:** first real card at y<=430 on 320x700 and 390x844 fresh Library; valid Continue in upper viewport; unchanged stored grades/exams, offline and print.

## Slice U2 — One Question Model

Expected source: src/app.js, src/study-position.js, src/app.css; tests/reader-mcq-single-item.spec.js, tests/phase-b-reading-exam.spec.js, tests/library-mcq-rated-progress.spec.js.

- [ ] Reuse existing Practice question navigation, not a second scoring engine.
- [ ] Reader MCQ displays exactly one authored question at a time by default with 1/N, Previous/Next, reveal/answer rationale and source-page link; Browse all is optional.
- [ ] Preserve exact question IDs, ordering and answerIndex; no silent Weak marking of unanswered items.
- [ ] Keep written MEQ self-rating explicit, MCQ correctness source-keyed, and Exam accuracy distinct.
- [ ] Persist question/lecture scope and restore it after reload; do not break deep links or backup state.
- [ ] Test authored 30/52/56 MCQ lectures, zero-MCQ Bladder Cancer, long bilingual options, offline and print.

**Acceptance:** no mandatory 30-MCQ long vertical stream on 320px, all authored questions available and correct answer behavior unchanged, tab/back/keyboard works.

## Slice C1 — truthful lecture availability

- [ ] Derive section capability labels from published metadata and actual authored guide sections; show Explanation, source MCQs, MEQ, shorts, source images and Rapid only when present.
- [ ] Distinguish private needs-source-review draft from published lecture.
- [ ] Display explicit unavailable states, never an empty false section or invented lecture explanation.
- [ ] Verify three MCQ lectures plus nine source-backed non-MCQ lectures; safeguard 138 reviewed keys.
- [ ] Track source PDF required for backfill but do not silently update exam facts or promise uniform science before PDFs are reviewed.

**Acceptance:** zero-MCQ lectures truthfully say no reviewed source MCQs, while their existing MEQ and images remain accessible.

## Slice A1/C2 — source-verified lecture intake & figures

- [ ] Keep Manage Library draft step clear: selecting PDF filename alone does not extract the PDF. Preserve private session draft and download contract.
- [ ] Inventory original PDF page-by-page, including text inside pictures, diagrams and tables; link every authored question/explanation back to source page and figure.
- [ ] Review source vs proposed explanation, MCQ/MEQ/shorts/images/rapid, distinct Understanding Aid; no added unreviewed medical facts.
- [ ] Pilot one end-to-end lecture through tools/import_library_draft.py, tools/add_lecture.py and atomic validated catalog insertion in a PR; test retries, duplicate IDs, wrong answerIndex, missing source image and rollback.
- [ ] Verify publication rights before shipping original source material in public GitHub/Worker.
- [ ] Complete declared SHA-256 and provenance for 58 image items whose hashes are absent only after verifying their original files/source pages; never redraw medical source figures.

**Acceptance:** one safely reviewed pilot can be added without changing any prior lesson or rating; validation failures leave published catalog unchanged; no unknown source diagram facts omitted.

## Slice Q1/Q2/Q3 — quality and long-term maintainability

- [ ] Fix sampled dark active navigation text contrast only after measuring actual alpha-composited foreground/background; ordinary text >=4.5:1.
- [ ] Investigate 32px source disclosure and 36px Read all topic controls; enforce actionable touch size >=44px; test tab, focus, screen-reader names, disabled, RTL and 200% zoom.
- [ ] Refactor repeated app.css reader/mobile overrides in narrow patches with screenshot parity; do not introduce a new framework for style alone.
- [ ] Benchmark ~7.6MB standalone opening on a representative low-resource phone and preserve pixel fidelity of informative original figures; optimize only after measurement.
- [ ] Make device-local save status and backed-up restore obvious, and test Cancel, corrupt backups, fresh profile, lost storage and unfinished exam recovery. Do not describe local data as cross-device sync.

## Release acceptance

- [ ] Run npm run quality:static, npm ci, npm run test:e2e and npm run test:webkit on SAME SOURCE SHA; inspect workers build, media/source parity and all failed/skipped checks.
- [ ] Validate every primary journey on 320/390/768/1024/1440, 200% zoom, dark/light, print and offline; no known P0/P1 reproducible defect.
- [ ] Maintain rollback and previous active Worker ID; promotion requires approved GitHub workflow and correct Cloudflare build-only behavior.
- [ ] Verify actual /version.json, Worker UUID, traffic and Access-authenticated browser. Merge is only MERGED / NOT RELEASED until then.

## Execution checkpoint 2026-11-18

This documentation defines requested future work only. No product code changed as part of the planning PR. First executable implementation plan is docs/superpowers/plans/2026-11-18-library-first-screen-sprint.md.

**Always log evidence for each slice:** issue/PR link, source SHA, before/after screenshot, static and browser test counts, merge SHA, production identity if verified, blocker or next action. Avoid estimated percent complete.
