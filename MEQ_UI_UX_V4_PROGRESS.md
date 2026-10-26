# MEQ Review Bank — UI/UX V4 Development & Progress Tracker

**Owner request:** a professionally refined, beautiful, fast medical study workspace with the simplest path to the next lecture/question; preserve every existing feature and every stored rating.  
**Last updated:** 2026-10-26 (Africa/Cairo)  
**Baseline main:** `5197bdd2685b2457db27b068d4c45a2a1a37a72f` (V4.3 release `2026.10.26.3`)  
**Working branch:** `ui/v4-bilingual-source-reading-20261026`  
**Production status:** V4.3 source is merged; independent read-only run `40253993643` reports active Worker `0b173e69-741c-4c79-8da0-568787e5a61f` at **100% traffic**, but protected browser smoke remains Access-blocked (HTTP 302, issue #35). **V4.4 branch is not live** until exact-head tests, merge and new Worker confirmation.
**Source of design evidence:** owner screenshots of Psychiatry and source figure cards; Chromium visual evidence artifact from main GitHub Actions run `40235201300` (320/390/768/1280/1440 desktop, mobile, dark and reading states); `src/index.html`, `src/app.js`, `src/app.css`, existing Playwright/axe/visual tests.

## Status legend and update rules
- **DONE** — implemented, reviewed, tests/evidence recorded; for deployment work only mark *LIVE* after production Worker traffic confirmation.
- **IN PROGRESS** — change actively being implemented on the working branch; not a claim of release.
- **TODO** — scoped and ready after dependencies.
- **BLOCKED** — owner/Cloudflare or source-rights input needed; document the exact dependency.
- Every task has an acceptance condition. Update this tracker **in the same PR** as the code; never call an unverified change done.

## Product direction (Impeccable: Operate + Read)
Clinical-quiet teal/ink, restrained off-white surfaces, original lecture media only. Course / Specialty / Lecture / Study mode should be obvious, while **Resume question** and **Exam mode** are the main student actions. Preserve existing colors and identity rather than applying a generic dashboard skin. Optimize exam-mode precision and source reading before decorative animation. CSS/JS should remain vanilla and dependency-free.

## Must-preserve inventory (non-negotiable)
- All registered courses/specialties/lectures, IDs, order, source-linked explanations, page references and exact original images.
- MEQ cases, core/detailed shorts, image spots, Rapid Recall, source-linked MCQs, auto-scored Exam mode and immediate answer feedback.
- Ratings (Weak/Review/Mastered), Daily Weak 15, Mistake Notebook, study analytics, progress history, stable keys and backup/restore.
- Lecture selection, search, topic/type/priority filters, print/PDF, offline/PWA, dark mode, mobile drawer and Focus Mode.
- No external/AI medical images, clinical-fact modifications, progress-key migrations, credential exposure or Access bypass.

## Development board

| ID | Priority | Status | Work package | Acceptance criteria |
| --- | --- | --- | --- | --- |
| V4-00 | P0 | DONE | Baseline design/feature audit | Inspect actual current CSS/JS and representative GitHub Playwright screenshots; record baseline and immutable feature list |
| V4-01 | P0 | DONE | Faster entrance into learning | Shorten mobile hero and secondary chrome; retain Course/Specialty + Start/Exam actions; next question immediately discoverable; no removed controls or overflow at 320/390px |
| V4-02 | P0 | DONE | Dark-mode contrast and keyboard focus | All visible navigation labels readable in both themes, normal text >=4.5:1; focus obvious; automated theme/contrast regression |
| V4-03 | P0 | DONE | Original figure **study reader** | Original source images legible beyond thumbnails; keyboard-accessible full-size viewer with zoom, close/Escape, original-source link and jump to associated image question; no substitutes; mobile responsive |
| V4-04 | P1 | IN PROGRESS | Unify overlapping navigation | One obvious study route Course → Specialty → Lecture → Study; hide secondary controls in progressive disclosure without deleting Course Library, sidebar or search |
| V4-04a | P1 | DONE | Find lectures by title | Scoped title search for large specialties, results, empty state, keyboard and mobile verified in PR #64 | 
| V4-05 | P1 | TODO | Question-first daily study session | Clear Resume, Weak queue, reveal, rating and question-progress states; consistent behavior between study/Exam and across refresh |
| V4-06 | P1 | IN PROGRESS | Reading typography & visual hierarchy | Arabic/English readable width, mobile font >=16px for long reading, scientific tables scroll/zoom, consistent headings and source labels |
| V4-07 | P1 | TODO | Consolidate V2/V3 CSS cascade | Audit redundant selectors/overrides; shared semantic tokens + dark variants; screenshots stable in 320/390/768/1280/1440 and zoom |
| V4-08 | P1 | TODO | Robust feedback/empty/recovery states | Course without lectures, image unavailable, offline, search no-match, outdated PWA, failed backup, interrupted exam all give useful next action |
| V4-09 | P1 | TODO | Accessibility, responsive and visual gate | CI axe + keyboard/Escape/focus, screen reader semantics, touch targets, 200% zoom, RTL, light/dark; record screenshot evidence |
| V4-10 | P1 | TODO | Source-first lecture intake UX | Draft/Review/Ready/Published pipeline for adding many PDFs; ensure image facts are explained and question-mapped; no public publication of unreviewed facts |
| V4-11 | P1 | TODO | PWA/performance & offline media | Check image budget, lazy loading, app shell and source figures offline; loading/caching clear, no lost progress |
| V4-12 | P0 | BLOCKED | Authenticated production browser QA | Cloudflare Access service-token policy + GitHub secrets as in issue #35; never disable Access |
| V4-13 | P0 | BLOCKED | Correct production promotion gate | Ensure Cloudflare Build uses `npx wrangler versions upload` until GitHub checks pass and explicit promotion succeeds (issue #50); avoid unreviewed automatic activation |
| V4-14 | P2 | TODO | Final whole-product review | Real lecture + figure + Exam + backup + print journeys, independent dark/mobile visual approval, issue triage, rollback evidence |

## First implementation increment — merged in PR #63
- **Scope:** V4-01/02/03; strengthen first viewport, legible dark controls and an original-source image reader, plus automated regression. The remaining board is *not* being silently marked completed.
- **Entry:** existing `Start studying` button (which already selects a saved Weak/Review item or next unrated item), course/specialty selector and actual image atlas.
- **Exit / definition of done:** exact PR-head static + Chromium + WebKit + Workers Builds green; screenshot check across 320/390/768/1440, light/dark; existing Dermatology and Psychiatry image assets intact; legacy ratings and course switching pass. Only then consider merge.
- **Why this scope first:** student currently encounters a large header and repeated navigation before a question; dark controls can fail readable contrast; information-rich DSM tables are difficult to read as thumbnails.


## V4 second implementation increment — lecture discovery
- **Stage 1 shipped source:** [PR #63](https://github.com/Hafezalhoot/medical-meq-bank/pull/63) merged into `main` as `e3c289d7ddf516c182392aea95c2faf210c1eb86`. [PR-head checks](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/40252330860) static, Chromium, WebKit and Workers Builds all succeeded. Cloudflare Worker `fe4e34c8-aa4d-483a-9985-c5d37aeb56fb` showed **100% traffic** in [main read-only release smoke](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/40252680199); the authenticated URL test still failed HTTP 302 due to Access #35. **Do not call authenticated production QA complete**.
- **DONE in [PR #64](https://github.com/Hafezalhoot/medical-meq-bank/pull/64):** added lightweight, specialty-scoped **Find a lecture** input when a specialty has at least five lectures; nonmatching titles are filtered in the existing nav without loading their bodies or changing saved ratings. A match-count, accessible empty state and Escape-to-clear keep selection predictable.
- **Acceptance:** desktop and narrow phone can reach a lecture with a title query and keyboard; empty query restores full list; course/specialty switching resets search rather than accidentally concealing lectures. All existing content, search, source JPEGs, offline features and current topic selection unaffected.
- **Status:** V4-04 remains IN PROGRESS (this completes only lecture discovery; simplifying other overlapping navigation remains TODO).


## Third increment — compact mobile reading context

- **Stage 2 DONE:** [PR #64](https://github.com/Hafezalhoot/medical-meq-bank/pull/64) merged as `dd44aa4d0bcb0c69866d882ab4c03908b74c2771`, after exact-head Static Validation, Chromium, WebKit and Workers Builds passed. [Read-only release smoke](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/40253332340) saw Worker `eafde86f-94ea-4815-b932-454ef47323ea` at 100% of Cloudflare traffic. The protected endpoint still returned Access HTTP 302 (#35): not a logged-in browser pass.
- **Stage 3 DONE:** [PR #65](https://github.com/Hafezalhoot/medical-meq-bank/pull/65) merged as `5197bdd2685b2457db27b068d4c45a2a1a37a72f` after Static, Chromium, WebKit and Workers Builds passed. Mobile breadcrumb now prioritizes the active lecture while course/specialty selectors remain; progress summary keeps the percentage and expanded stats. The read-only Worker check saw 100% active traffic; the authenticated browser test remains blocked by Access #35.
- **Accept:** first lecture enters the reader sooner at 320/390px; narrow mobile no horizontal scroll for long lecture titles; progress stat summary keyboard/touch-operable and content unchanged; desktop 768/1440 full breadcrumb remains, dark mode readable.
- **Scope honesty:** V4-06 stays IN PROGRESS: this is a targeted hierarchy/density pass, not an assertion that typography and every source table are final.

## Fourth increment — V4.4 bilingual source reading and private original-figure UX

- **On working branch, pending exact-head CI:** Arabic Explanation and Understanding Aid paragraphs use RTL and `lang=ar` even when the first word is a Latin medical term (for example "Fear"); English-only prose retains `dir=auto`. No medical text or MCQ key is rewritten.
- Tighten Explanation/MCQ reading measure from 80ch to 76ch. Increase original-source PDF captions, source-page labels and image-viewer metadata, including the 320px mobile overrides, without adding visual clutter.
- Fix source zoom viewer for **same-origin blob URLs representing validated private IndexedDB JPEGs**: the V4 reader previously accepted only hosted `./assets/lectures/...jpg` links, so verified imported source pictures were opening outside the in-app zoom viewer. The viewer now accepts both paths while maintaining the original new-tab fallback and the source-only card requirement.
- New Playwright regressions check real Anxiety PDF prose that begins with a Latin term, RTL/size/overflow, 320px caption legibility in light/dark, and a byte-identical source figure loaded through a private blob URL.
- **Gates:** full exact-head static, Chromium, WebKit, Workers Builds; no deployment or authenticated production browser pass is claimed until independently verified. V4-06 and V4-04 remain IN PROGRESS; the remaining roadmap stays TODO/BLOCKED.

## Evidence log
| Date | Commit / PR | Work | Evidence | Outcome |
| --- | --- | --- | --- | --- |
| 2026-10-26 | Baseline `80721a55` | Reviewed current V3 UI, screenshots and code | Chromium Actions artifact `40235201300`, `UI_V3_REDESIGN.md`, `src/app.css`, `src/app.js`, `tests/layout.spec.js` | DONE — 7/10 subjective starting point; risk inventory above |
| 2026-10-26 | [#63](https://github.com/Hafezalhoot/medical-meq-bank/pull/63) | V4-01/02/03 hero, dark mode, source figure viewer | PR-head run 40252330860: all four checks passed; main `e3c289d`; Cloudflare Worker 100%, Access 302 | DONE (source and deployment; authenticated smoke blocked) |
| 2026-10-26 | [#64](https://github.com/Hafezalhoot/medical-meq-bank/pull/64) | V4-04a title search | PR-head Static/Chromium/WebKit/Workers Builds passed, main `dd44aa4d`; Cloudflare eafde86f 100% (Access 302) | DONE (V4-04 wider work remains) |
| 2026-10-26 | [#65](https://github.com/Hafezalhoot/medical-meq-bank/pull/65) | V4.3 mobile study context | Exact-head Static/Chromium/WebKit/Workers Builds passed; main `5197bdd`; read-only run `40253993643` Worker `0b173e69` 100% (Access 302) | DONE source + active Worker; authenticated browser QA BLOCKED |

## Release checklist for each iteration
- [ ] User-facing design changes match actual screenshots, with no fabricated visuals or data.
- [ ] Static build/validation, full Chromium and WebKit tests green on **same exact head**.
- [ ] No source lecture medical facts, hashed original photo assets, IDs, questions or answer keys modified by UI work.
- [ ] Confirm browser save/restore, offline return, Weak/Review and Exam remain working.
- [ ] GitHub PR merged only after green checks. Production Worker 100% traffic *independently verified*.
- [ ] Update **DONE / IN PROGRESS / TODO / BLOCKED** and evidence before reporting final status.

## Known dependencies / risk notes
1. **Issue #35:** Cloudflare Access redirects anonymous smoke to login (HTTP 302). CI viewport screenshots exercise built local source, not fully authenticated live browsing.
2. **Issue #50:** Cloudflare Workers Builds can auto-activate new main before post-merge quality finishes; owner should set build-only upload and gated promotion.
3. Source figures are published from the user-supplied PDFs; retain provenance and separately verify public redistribution rights.
4. Older `PROJECT_PROGRESS.md` and `MEQ_PRODUCT_ROADMAP_2026-10-22.md` contain dated release snapshots: this document governs **UI/UX V4** statuses, not historical claims.
