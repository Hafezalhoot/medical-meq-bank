# MEQ Studio — V5 World-Class Design Rebuild

**Design brief:** Replace the teal corporate/dashboard feel with a distinct, serene, premium study application. User provided actual 1535×1023 desktop screenshot of Psychiatry overview and requested world-class color, composition, sizing, layout, organization and interaction—not a minor CSS polish.

**Baseline:** main `8745ae812d971328f8da0a1f099be7d25728be18` (V4.8, 2026-10-26).  
**V5 shipped:** PR #71, main `dc3819f16b9bd9f6680d3ebe39246ce795710aa7`, Worker `b873bcb3-067b-4478-8943-d354f46f2eff` at **100%** (read-only Cloudflare report on 2026-10-26 13:11 UTC). Source CI: **151 Chromium tests passed**, WebKit, static and Workers Builds green.  
**V5.1 working branch:** `hardening/v5-safe-backup-restore-20261026`. Candidate `2026.10.26.10` — **NOT LIVE** until full exact-head CI, merge and live Worker confirmation.  
**Design system:** [DESIGN.md](DESIGN.md)

## Direction
- **Mood:** Mineral Blue / pearl / deep slate ink; quiet academic precision, not neon, glassmorphism or cartoon clay.
- **Palette:** `#F5F7FC` background, `#FFFFFF` surfaces, `#24304B` main text, `#4F63A8` action, `#E9EDFB` selection, `#E0E6F1` stroke; dark scheme `#121828` / `#1D2740` / `#AABBFF`.
- **Layout:** top brand/utility masthead; content-led study canvas with course/specialty + Start/Exam; restrained course/review access; calm course overview; rich but readable explanation/exam surfaces.
- **Interaction:** no lost functionality. All native course, specialty and question selectors, Weak/Review/Mastered, source images, search, Exam mode, Focus mode, Dark mode, print, backup/restore and offline remain available.
- **Image rule:** absolutely no invented or AI medical photos. Only authentic source figures already in lecture payload.

## Execution board

| ID | Priority | Status | Work | Acceptance |
| --- | --- | --- | --- | --- |
| D5-01 | P0 | DONE | User screenshot and code/state audit | Real source screenshot and deployed V4.8 repository reviewed; all preserved IDs/features listed |
| D5-02 | P0 | DONE | New visual system and app masthead | Light/dark blue palette; separate keyboard-accessible utility bar; real course+subject buttons reachable |
| D5-03 | P0 | DONE | New study canvas, overview & wayfinding | Disciplined typography/spacing; lecture cards and selection; Start/Exam discoverable without more clicks |
| D5-04 | P0 | DONE | Reader and source imagery | Comfortable 74ch measure; original figures unchanged, bilingual RTL notes and MCQs legible |
| D5-05 | P0 | DONE | Exam/print/PWA dark system | Exam and print screens use same restrained design tokens; offline install and storage unaffected |
| D5-06 | P0 | DONE | Responsive/a11y/visual regression | Check 320/390/768/1024/1440, dark, focus, keyboard, no overflow, original source reader; pass full CI |
| D5-07 | P0 | DONE | Safe code merge & Cloudflare release verification | Exact PR SHA green: Static, Chromium, WebKit, Workers Builds; independently verified active Worker 100% |
| D5-08 | P1 | BLOCKED | Authenticated production browser verification | Cloudflare Access service token issue #35 resolved without changing access policy |
| D5-09 | P1 | IN PROGRESS | Subsequent visual audit using actual V5 screenshots | Compare source CI screenshot artifacts and owner screenshots; polish genuine breakpoints |

## Source governance & recovery

- There is **no new external font or design library** (offline PWA still works).
- Changing CSS classes/colors cannot change progress records, question IDs, answer keys, source photo SHA-256 or student data.
- On failing CI or inaccessible production Worker, do **not** claim merged/live; keep previous V4.8 production running.
- Cloudflare Access still prevents unauthenticated production browser smoke (issue #35). Build success ≠ proof of logged-in UI.
- Main auto-deployment before post-merge quality is separately tracked in issue #50. Respect safe-release dependency.

### 2026-10-26 — Exact-head QA pass: vertical rhythm (in progress)

- Chromium report on `5d9017f` had 149 tests passing, 1 failure: first lecture starts at y=771px at 1280px, exceeding the preserved y<750px first-screen contract by 21px. Mobile full-name selectors, real reader width, revision history and Safari/WebKit passed.
- Fix the root composition rather than weakening the test: reduce excessive desktop masthead, study canvas, quick-link, insight and navigation margins by about 35–40px while retaining 44px controls, all features and source images. No medical data or progress storage changes.
- **Release gate:** this is not marked DONE or LIVE until the exact candidate head passes all tests and production Worker traffic is independently verified.

### 2026-10-26 — Shortcuts instead of redundant headings (QA candidate)

- Re-run `1745348`: **150 Chromium tests passed, 1 failed** solely because first study item was at 722px on a 1440×900 viewport (limit 700px). 320/390/768/1024/1280 layout checks, source readers, 601-record history, dark mode, accessibility and WebKit passed.
- Condensed **Explore your courses** and **My Review** to compact ≥56px disclosures (retain titles, counts, keyboard access and expanded details). Removed duplicated descriptive lines from the closed shortcuts. Reduced expanded-overview progress bar chrome, leaving actual study content, medical images, study controls and progress logic unchanged.
- Verify exact-head Chromium + WebKit + Cloudflare Workers Build before merging. Previous live Worker remains unchanged until explicitly confirmed.

### Final spacing refinement — CI candidate

- `21327db` browser QA: **150/151 Chromium checks passed**; only the first-lecture offset at 1440px failed by **1.125px** (701.125px vs strict <700px). WebKit and Static remained green.
- Keep the same meaningful reader-first contract. Tighten only redundant breadcrumb and filter block spacing (roughly 10px), without shrinking any text or changing student actions.
- Final merge remains gated on new exact-head Static, Chromium, WebKit and Cloudflare Workers Build results.

### 2026-10-26 — Protected automatic Cloudflare promotion (release candidate)

- Exact-head V5 visual quality **passed** on `4df95ce`: all Static, Chromium, WebKit and Cloudflare Workers Build checks green. 151 browser tests included. Source content and progress stores unchanged.
- The existing GitHub `promote-production.yml` is extended to respond to successful **main-push `Validate Medical MEQ Bank` workflow_run only**, not untrusted pull-request results.
- Production is fail-closed: require main ref and same repository, exact current main SHA, full validate/Chromium/WebKit success, an exact matching successful Cloudflare Workers version, and valid stored secrets. Manual dispatch with explicit confirmation stays available.
- **Not live at commit time.** Verify post-merge main CI, promotion workflow execution and active Worker at 100% before marking DONE/LIVE. Cloudflare Access browser smoke still needs owner-provided service credentials (issue #35), not an access bypass.


## V5.1 — Project-wide review and safe restoration (2026-10-26)

- **Baseline:** 12 published lecture JSON files: Surgery 9; Internal Medicine II 3 (Dermatology 1, Psychiatry 2). Source asset path check found no missing local image assets among the reviewed image-question paths. The 3 source-reviewed MCQ packs contain 138 MCQs; other lectures have no approved auto-scored MCQ payload.
- **P1 data safety:** Previously selecting a structurally valid progress backup immediately overwrote the active device progress/preferences. V5.1 presents current/incoming ratings, removed/changed counts, a one-click current-backup download, and explicit Cancel/Escape or Confirm. Existing transaction rollback remains in place.
- **Regression:** Test invalid, empty, cancelled, confirmed, legacy/current schema, simulated write/rollback failures, responsive 320px, keyboard Escape and one-click backup export. Do not change lecture source media, answer indices or permanent item IDs.
- **P2 accuracy:** Update the stale README (10 → 12 lectures) and stale V5 ship status. Rename offline connectivity pill to "Offline" rather than suggesting every lecture is available offline without saving it.
- **Outstanding:** #50 Cloudflare Workers Builds can deploy before post-merge tests (needs owner configuration of production deploy command to build-only); #35 authenticated Access smoke blocked by missing service token; #53 editorial review of Bladder Cancer MCQs; #24/#25/#26 lecture ingestion workflow.
- **Release gate:** V5.1 is not considered published until required static, Chromium, WebKit and Cloudflare build checks are green, and read-only active Worker version is independently verified. Authenticated production QA remains a separately acknowledged limitation.


## V5.2 — Study-history-safe restores (2026-10-28)

- **Release state:** candidate `2026.10.28.1`, branch `hardening/v5-2-restore-study-history-20261028`, NOT LIVE until full CI/merge/Worker traffic proof. V5.1 `2026.10.26.10` was merged as main `3f8def77` (PR #72), pre-merge Static/Chromium/WebKit/Workers Builds green, and read-only Wrangler saw active Worker `46a8c66c-9ef4-4acd-9b30-fc061973f27a` at 100% traffic.
- **User-impact gap:** a backup can replace mistake-notebook entries, completed exam history and a saved unfinished exam even when the summary of per-question ratings looks harmless. The prior preview mentioned preferences but did not show study-history counts.
- **Change:** compact `Other saved study history being replaced` comparison: distinct mistaken-source questions, completed exams and unfinished exam yes/no, each from current storage versus imported backup. Missing records count zero; malformed stored JSON shows `?` rather than silently displaying zero.
- **Regression:** browser tests prove exact comparative values, 390px modal/Cancel with zero mutation, confirmed replacement, missing/invalid history safe defaults and Escape at 320px. Original medical answers, images and progress storage formats remain unchanged.
- **Release blockers outside this candidate:** owner-side Cloudflare build-only Deploy command (#50) and scoped Cloudflare Access service token for authenticated live browser smoke (#35); do not disable Access.
