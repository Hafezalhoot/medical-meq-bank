# Medical Study Workspace V2 — UX Modernization Plan

**Status:** In development on `design/medical-study-workspace-v2-20261016` (not deployed).  
**First candidate version:** `2026.10.16.1`  
**Baseline:** `main`, release `2026.10.04.2`

## Audit and architecture

The source-backed product review, information architecture and prioritized usability findings are documented in [UI_V2_AUDIT.md](./UI_V2_AUDIT.md). UI/UX guidance is informed by UI/UX Pro Max and the existing Clinical Study Workspace design system; the implementation stays dependency-free.

## Product goal

Evolve Medical MEQ Bank into a calm, accessible, offline-first study workspace that scales from Surgery to every medical course while preserving the reviewed exam content, existing question formats, stable IDs, and the learner's saved progress.

**Core user journey:** Course Library → Specialty → Lecture → Study mode → Answer / rate confidence → Continue where you stopped.

## What already exists and should be reused

| Capability | Source | Direction |
| --- | --- | --- |
| Course and specialty registry | `courses/catalog.json`, `courses/packs/*.json`, `src/course-packs.template.js` | One canonical source for all course navigation |
| Lecture-level metadata + lazy loading | `src/lecture-loader.js` | Never fetch the whole bank to display a dashboard |
| Clinical cases, shorts, image/spot, detailed questions, Rapid Recall | `src/app.js`, lecture JSON | Keep formats and reviewed medical answers unchanged |
| Personal study progress + backup | `src/progress-resilience.js`, `src/pwa-client.js` | Preserve IDs and existing device data |
| Search, filters and subject-scoped indexing | `search-optimization.js`, `review-filter.js` | Preserve fast navigation as subjects grow |
| Offline lessons + installable PWA | `service-worker.js`, `src/pwa-client.js` | Keep selective lecture caching |
| Print / Save as PDF | `src/print-manager.js` | Maintain printing across new UI |
| Responsive and accessibility regression matrix | `tests/*.spec.js` | Extend, never remove or weaken |

### Content availability at V2 kickoff

The registry contains **Surgery** (4 specialties; reviewed lectures present) and **Internal Medicine** (7 configured specialties; no published lectures yet). Empty specialties must display honest `No lectures yet` states, not placeholder medical facts. Future courses enter through reviewed course/lecture catalogs, not hard-coded interface screens.

## UX architecture

1. **Study Home** — `Continue studying`, course library, recently visited lecture, and meaningful progress. Keep it focused; no decorative KPI dashboard.
2. **Course Library** — every course appears automatically from the catalog; show whether study content is available. Course-specific subject selection and progress.
3. **Specialty view** — overview of lectures, completion, filters and a single clear primary next action.
4. **Lecture workspace** — readable study content with contextual course breadcrumb, lecture outline, and low-noise study controls.
5. **Study modes** — existing Practice/Recall/Image workflows remain; future Explanation, MCQ and infographic views activate only when reviewed source-backed material exists.
6. **My Review** — existing Mastered / Review / Weak data surfaces useful review queues, without inventing spaced-repetition scheduling.
7. **Study utilities** — search, backups, offline packs, print and appearance remain available without competing with the study task.

**Navigation principle:** No duplicate parallel navigation hierarchies. A user should be able to switch courses without accidentally resetting the active course progress.

## Design system direction

Use the existing Clinical Study Workspace `UI_DESIGN_SYSTEM.md` (calm blue/teal semantic colors, offline-safe system fonts, accessible contrast, 4/8 px spacing, consistent SVG icons). UI/UX Pro Max recommended an accessible LMS dashboard + course grid. Adapt this to a **progressively revealed course library**, so the current study page still prioritizes content rather than pushing questions below another large dashboard.

Never add a dependency, global framework, external font, animation library, or generic landing page without a measured need.

## Delivery plan and gates

| Phase | Output | Acceptance criteria | Status |
| --- | --- | --- | --- |
| V2-0 Product + source audit | Route/feature inventory, risks, scope and new delivery branch | Exam facts and persistent ID boundaries explicit | Done |
| V2-1 Course Library | Responsive expandable catalog-sourced course cards | All configured courses discoverable; switching works; empty future pack honest; no extra lecture-body fetch; keyboard operable | ✅ Code + full CI passed (run 38905559158); manual visual QA pending |
| V2-2 Study Home | Compact course progress + Continue Studying using existing metadata/progress | No full-corpus fetch; empty/new user states correct; useful on desktop/mobile | Planned |
| V2-3 Specialty / lecture organization | Unified lecture cards, outline and quiet reading workspace | Clear location, fewer competing controls, print and navigation unaffected | 🟦 Compact chrome + Focus Mode + Images quick view delivered; further reader organization planned |
| V2-4 Study experiences | Consistent Practice, Recall, Images; optional source-backed Explanation/MCQ/Infographic modules | Optional formats do not alter or invent lecture facts; lecture-first validator contract | Planned — needs reviewed lecture data |
| V2-5 Progress + review | Meaningful Review/Weak queue and cross-course progress | Existing IndexedDB v2 remains compatible; back up / restore round-trip works | Planned |
| V2-6 Mobile / dark / accessible polish | 360, 390, 768, 1440 widths, keyboard, contrast, focus, reduced motion | No overflow, 44px controls, accessible dialogs, Chromium + WebKit passed | 🟦 Chromium+WebKit green; 390px light/dark and 1440px candidate screenshot review completed; 360px and real-device sign-off pending |
| V2-7 Production release | Final regression matrix, PR review, rollback, deployment | Protected main + green CI; upload candidate then explicit Cloudflare promotion | Planned |

## Current implementation — V2-1 and first reading-workspace pass

- Added a collapsible **Explore your courses** section under the header, closed by default so it does not delay a returning learner.
- It is generated from `MEQCourseRegistry`: course title, description, specialty count, and a status based on an attached published lecture catalog.
- Clicking a course activates the existing `activateCourse` path, preserves its remembered specialty, updates selected/pressed state, closes the library and returns focus to specialty selection.
- Added a Playwright end-to-end check for Surgery → Internal Medicine → Surgery navigation, empty future-course states, and the direct Browse Courses recovery action.
- Aimed to leave all existing question rendering, search, progress, backups, PWA, and Print Center untouched.


### V2 reading workspace improvements (2026-10-16)

- Production screenshot review found excessive hero height, competing sidebars, all-seven-metrics prominence, and repeated decorated question surfaces.
- Reduced the promotional hero area and repeated metadata, without removing the existing course/specialty controls, Install App, backups or dark mode.
- Added an expandable study progress summary; the existing seven counters and progressbar semantics remain inside it.
- Added **Focus on questions** with the `medicalBankFocusModeV1` key (UI preference only) and an always-visible Exit focus action.
- Added **Images** to the existing lecture Quick Views beside Cases and Short Questions.
- Tightened desktop navigation widths, contrast-safe borders, screen hierarchy, mobile touch sizes and reading card density.
- Added browser regressions for Focus Mode persistence, progress disclosure, and Image Quick View.
- The final full matrix passed on run [38909175547](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38909175547).
- The current PR is still draft; **no source lecture/answer data was edited**, and preview release isn't promoted.


### V2 visual evidence and mobile density correction

- The first V2 browser images exposed an overly tall phone header and a stacked three-row mobile navigation, even though the original runtime tests were green.
- Fixed both problems: Study tools expands on demand without hiding the online badge, two selectors share one row, and all four main reading actions share a single row.
- Reworked the desktop header selector pair and lecture quick actions to reduce before-content scroll.
- Added an automatic Playwright screenshot evidence suite (desktop study, course library, detailed progress, focus mode, light mobile, dark mobile) attached to the existing Chromium report.
- Reviewed the final six actual browser screenshots and confirmed the intended visual changes. Full matrix green: [run 38912689508](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38912689508).
- Next phase: cross-course Study Home and meaningful learner review destinations, implemented with existing progress metadata and no speculative medical facts.

## Non-negotiable release checklist

- [x] New `2026.10.16.1` version matches service worker and PWA client.
- [x] Full static build/source data validation passes (GitHub Actions `validate`).
- [x] Chromium, axe, layout, course-pack and mobile regressions pass.
- [x] WebKit/iPhone smoke suite passes.
- [ ] No new external resource requirement or injected executable code.
- [ ] No medical answer/question/content edits in UI-only PR.
- [ ] No break in IndexedDB stored progress, backup, and offline pages.
- [ ] Protected PR green before merging; Cloudflare promotion only after approval.

## V2 browser visual evidence — 2026-10-16

- ✅ Final current-head app/navigation layout and course selector browser run [38912689508](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38912689508) passed all **validate / chromium-quality / webkit-quality** jobs on `8b141de972b3048d78ec19cf3af5240a79381be6`.
- ✅ Inspected genuine Chromium Playwright screenshot artifacts at desktop 1440×900, phone 390×844, expanded Course Library, expanded Stats and desktop Focus Mode.
- ✅ After screenshot-driven iteration: mobile utilities folded into Study tools; two-column Course/Specialty picker on mobile and desktop; one-row mobile Lectures/Topics/Focus/Print actions; concise header and calm reading surfaces; focus mode remains reversible.
- ✅ Exported human-review screenshots from the CI build (not synthetic mockups); attached to conversation for product design review.
- ⚠️ Impeccable skill is **not installed** in this environment. Applied available public critique/distill/polish concepts and UI/UX Pro Max patterns, not an Impeccable tool audit.
- ⏳ Retain PR #23 as Draft until stakeholder visual acceptance and any remaining cross-course Study Home / My Review improvements are scoped into following increments. Production main and Worker remain untouched.

## Rollout

Keep the existing `2026.10.04.2` production Worker intact until V2 has been visually reviewed and automated tests pass. Each phase may have its own small PR; do not combine unrelated data migrations with visual changes. Save browser screenshots for desktop, small phone, dark mode, and expanded course library before final merge.
