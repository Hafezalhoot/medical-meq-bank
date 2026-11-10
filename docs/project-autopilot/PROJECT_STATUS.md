# My Medical Library — Project Autopilot status

## 2026-11-10 — V6 offline My Review initialization (verified regression candidate)

- **Current source:** main `e6bfc26055893353969ff09100980bd2f18fec24` with V6 Library/Practice/Review/Exams/Manage already integrated. Earlier V3 hotfix branch is obsolete and intentionally not merged.
- **Reproduced bug:** the standalone offline HTML embeds 12 lectures but has no `MEQLectureLoader`. Opening My Review displayed `Lectures are still loading. Close and reopen My Review.` indefinitely. Captured actual Chrome RED state, then GREEN with empty review queue. This is a functional regression in the current standalone V6, not evidence that Cloudflare production is V6.
- **Fix:** My Review now uses already-embedded metadata in standalone HTML, while networked app waits for its lecture loader and refreshes automatically when ready. No clinical content, source images, stored question IDs, progress data or exam scoring changed.
- **Regression:** `tests/my-review.spec.js` now opens the actual standalone export and checks its empty state without `MEQLectureLoader`. PWA cache identity bumped coherently to `2026.11.10.1`; exact-head CI pending.
- **Production warning:** latest scheduled Cloudflare smoke failure (Nov 9, [#42655224289](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42655224289)) comes from Access HTTP 302, and missing approved service-authentication secrets. Main static/Chromium/WebKit validation [#42461642683](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42461642683) passed. Protected V6 preview was previously verified, but **V6 is not proven active on public production**. Do not bypass Access or auto-promote merely to silence smoke.

## Online release request — 2026-11-08

**Latest state (supersedes preparation and historical draft notes below):** [PR #89](https://github.com/Hafezalhoot/medical-meq-bank/pull/89) combined the V6 dependency chain and merged normally as `11397f4d676202707ad85f75ff305cc849ab28f6`. Exact PR head `3ece79b003b6e92ed0580003754a32735d03486a` passed static, Chromium, WebKit and Workers Builds ([CI #42460103834](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42460103834)). Exact merged-main validation also passed all three jobs in [#42460522700](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42460522700), with Workers Builds green. Main uploaded Worker `62297284-b0c2-407e-830f-96b4a1b17d3d`; its HTTP 200 manifest matches `2026.11.07.1`.

The old production smoke failed against that real preview because it expected the V3 hero and previous stacked interface. Follow-up `fix/v6-production-smoke-20261108` uses the accepted V6 Library, visible reader modes and management screen, retaining exact asset versions, 14 original JPEG hashes, 30 Dermatology MCQs, responsive checks, PWA stale-CSS rejection, dark mode and Access credential confinement. The updated script passed on the main preview; the intermediate management assertion was corrected to retain the selected course. Full local static gate and all three credential/redirect safety regressions passed. This is preview evidence, not production signoff.

Next: complete the smoke follow-up's exact-head PR/main gates and configure approved Access service authentication per #35, then use the existing protected manual promotion and authenticated smoke. Owner action was requested securely; no credentials should be sent in chat. The read-only Access applications API returned zero applications for this account, so the protecting application's identity remains unconfirmed. Do not create a competing application or disable protection. Active rollback Worker remains `6b5d76a0-5409-4ff8-8245-78438d7105d4`; production has not been activated. The production environment has no required reviewers; release consent is the owner's explicit request plus the manual workflow confirmation.

### Earlier preparation notes

Independent release review additionally proved that repeated hash navigation reused the same document. PR #90 explicitly reloads after poisoning the old CSS cache and asserts a fresh document time origin before accepting the PWA result. Re-run exact-head checks after this correction; do not count the earlier same-document PWA pass as fresh-load evidence.

The owner has explicitly authorized publishing V6 to the existing site. PR #89 now targets `main` as one combined V6 release, with the application source unchanged from tested candidate `2026.11.07.1`. Normal PR-triggered checks and exact merged-main checks remain mandatory. Read-only preflight [#42459758485](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42459758485) verified both Cloudflare triggers use `npx wrangler versions upload`; the production trigger targets `main` and the connected repository/build command match this project. This removes the formerly unknown build-only configuration; issue #50's full activation proof still needs the controlled release.

The remaining live-smoke prerequisite is Cloudflare Access: HTTP 302 and absent `MEQ_CF_ACCESS_CLIENT_ID` / `MEQ_CF_ACCESS_CLIENT_SECRET`. Current active/rollback Worker is `6b5d76a0-5409-4ff8-8245-78438d7105d4` at 100%. No Access policy or production traffic has been changed. The diagnostic branch is separate from application source; local detector-only exceptions are untracked. Do not mistake source integration or a successful preview for completed production activation.

## Current continuation — 2026-11-07 (supersedes older handoff below)

- **Repository:** `Hafezalhoot/medical-meq-bank`; inspected `main` at `cb0d193c447623b5b52784ab6d5e73d4275f400e`.
- **Latest real UI base:** V6 UX-04A `dd89bf5fb6c4c446f2041583eef2322e9a06f9a5`, not main. Dependency chain: UX-01 [#84](https://github.com/Hafezalhoot/medical-meq-bank/pull/84) → UX-02 [#85](https://github.com/Hafezalhoot/medical-meq-bank/pull/85) → UX-03 [#87](https://github.com/Hafezalhoot/medical-meq-bank/pull/87) → UX-04A [#88](https://github.com/Hafezalhoot/medical-meq-bank/pull/88). These remain separate draft PRs. Existing source is vanilla HTML/CSS/JS, not React.
- **Working branch:** `feature/v6-guided-authoring-ux05-20261107`; candidate `2026.11.07.1`. New `#/manage` four-step metadata intake + strict local importer, optional Chapter handoff, no changes to registered structure or clinical content. [Spec](../superpowers/specs/2026-11-07-guided-library-intake.md), [plan](../superpowers/plans/2026-11-07-guided-library-intake.md), [authoring instructions](../../CONTENT_AUTHORING.md).
- **Verified execution source:** `1b3ddfa118fe4be262d365ae3a80750e57929a79`, [official CI #42392300567](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42392300567): static/70 Python, 217 Chromium, 16 WebKit tests green; two intentional existing device-specific skips. Cloudflare Workers Builds green. Locally the same 217 Chromium tests passed after using a static server with a larger request queue; default-server connection-reset attempts were failed runs, not passing evidence. Final documentation-only head and exact-head checks are tracked in [draft PR #89](https://github.com/Hafezalhoot/medical-meq-bank/pull/89).
- **Preview verified:** [Worker `0ae85f3c`](https://0ae85f3c-medical-meq-bank.hafztamr.workers.dev/#/manage), full version ID `0ae85f3c-6c52-46cc-b48d-1ef3752ce5ff`. HTTP 200 `/version.json` matched `2026.11.07.1`. Six authoring scenarios passed against this preview, with the standalone scenario using the local generated offline file. No production promotion implied.
- **Independent review:** identified that repeated/trailing hyphens could create an ID accepted by the wizard/importer but refused by the V6 reader. Added failing browser/Python regressions, aligned both intake boundaries to the reader grammar. Two inherited macOS symlink path failures and an independently reproduced native-selector crop were repaired without changing test assertions. First local Chromium run with two workers had startup timing failures; final run uses the CI's one-worker setting.
- **Production evidence:** read-only [smoke run #42391542570](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42391542570) on 2026-11-07 16:30 UTC reported Worker `6b5d76a0-5409-4ff8-8245-78438d7105d4` at **100%**. Live `/version.json` still redirects HTTP 302 to Cloudflare Access; full authenticated live smoke failed. This is the active existing Worker, not the new V6 candidate. #35 and #50 remain open; dashboard build-only deployment setting has not been independently verified. No main merge or production activation in this continuation.
- **Preserved:** 3 courses, 12 published lecture packs, 138 authored MCQs, existing image hashes, question/progress IDs, IndexedDB, backups, exam grading, print and offline flows. The legacy builder rematerializes two tracked lecture files; discard only those build-created diffs before committing this UI/tooling slice.
- **Design review:** existing V6 sage/slate tokens and native controls retained. Independent reviewer scored the ID fix and stable-dark recapture resolved and gave a scoped ship verdict; primary button contrast 9.23:1. Documenter verification passed. Whole-source static detector warnings refer to inherited legacy hero/utility typography, contrast, spacing and glow declarations; none suppressed. Historical V5/V6 DESIGN.md drift was reported and preserved.

## Next unblocked slices

1. Review [draft PR #89](https://github.com/Hafezalhoot/medical-meq-bank/pull/89) and its exact-head source/Chromium/WebKit/Workers checks; keep it draft until the V6 dependency chain is approved. No known outstanding fix from the scoped independent review.
2. UX-05B: reviewed creation/editing of new Material/specialty/Chapter metadata and recoverable downloaded drafts. Current UI selects existing structure only.
3. UX-04B: dedicated saved Review and exam setup/result presentation, reusing existing rating/scoring engines.
4. Consolidated responsive/RTL/a11y/offline QA, then protected-main integration and authorized promotion after #35/#50 account controls are resolved. Never bypass Access or infer production success from preview CI.

---

## Archived V5 handoff (historical)

## Owner-approved product direction
**My Medical Library · Lectures · Questions · Exams** is the personal lecture-first medical study application; MEQ is one supported question type, not the overall brand. Lecture-First Policy still controls every exam fact, and explanatory additions must be labeled as aids, not new exam facts.

## Repository and release baseline
- Repository: `Hafezalhoot/medical-meq-bank`; production branch `main` remains at `2f0d6e8d0e7daec4000cb41607d09b15e6d28d25` (V5.2).
- Source inventory: 3 courses, 12 published lectures; 138 reviewed auto-gradable MCQs in 3 lectures; historical MEQ, short, image/spot, Rapid Recall and exam workflows remain intact.
- Existing device-local progress, IndexedDB exam history, safe backup/restore, original figures with SHA provenance, offline cache and print must be preserved.

## Branch/PR sequence (2026-11-04)
1. **V5.3 identity & compact reader foundation:** [PR #75](https://github.com/Hafezalhoot/medical-meq-bank/pull/75), head `50ef65e26cdb1a4bf773848596a86fb205635e21`, ready for review, not merged. [Full CI #41784312773](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/41784312773) **passed** (Static + 162 Chromium + 4 WebKit).
2. **V5.4 source guide reader entries:** [PR #76](https://github.com/Hafezalhoot/medical-meq-bank/pull/76), stacked from #75, draft pending full tests. A separate plan is at `docs/superpowers/plans/2026-11-04-lecture-workspace-entry-points.md`. The branch temporarily targets `main` for CI, because the workflow only triggers on PRs targeting `main` — **do not merge it ahead of #75**. Retarget or rebase once #75 is safely integrated.

## V5.4 scope
- Remove the ambiguous combined study guide shortcut and offer separate **Explanation**, **MCQ practice**, **Infographic** and **Original lecture figures** actions only where an authored section exists.
- Each source-action opens its exact native `details`, scrolls to it and focuses its summary; preserve course/subject and source facts.
- In multi-lecture specialties, a lecture-header **All lectures** control returns to the current specialty index and restores keyboard focus. Hide this control when the specialty contains only one lecture.
- Rotate PWA version to `2026.11.04.2` for safe asset-cache invalidation.
- Test actual Dermatology authored Explanation/MCQ/14 original figures, legacy Bladder Cancer without false guide entries, 390px mobile, source section focus and overview return.

## Quality and safety gates
- **V5.4 implementation is committed; CI on final head is pending.** Never state that the new reader work is tested/live until the exact-head Static, Chromium and WebKit run finishes green.
- No `lectures/` or `courses/` change, no new medical content, no photo/hash changes, no exam answer-key or saved progress/storage migration.
- Cloudflare Access authenticated production smoke [#35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35) and Cloudflare auto-promotion before main CI [#50](https://github.com/Hafezalhoot/medical-meq-bank/issues/50) remain unresolved; **no production deploy/merge** in this iteration.
- A connected code checkout and authenticated production browser are unavailable in this environment; GitHub Actions supplies the integration test evidence.

## Next slices after current checks
1. Verify exact PR #76 test results and review its final diff for source/schema/storage changes; mark ready for review if clean.
2. Rationalize Study Home → Courses → Lectures navigation, then unified question reader/type filters without inventing missing MCQ/Explanation data.
3. Pilot lecture-PDF intake with page-by-page text *and information-dense figure* coverage, original provenance and editorial approval before any publication.

## 2026-11-05 — V5.9 private lecture source-review evidence

- Branch/PR: `feature/lecture-review-verification-v5-9-20261105`, [PR #82](https://github.com/Hafezalhoot/medical-meq-bank/pull/82), stacked after #80 → #79 → #78 → #76 → #75. Release gate PR #81 remains independent and must be reviewed before any production activation.
- `tools/lecture_review_report.py`: generates a private, pagewise PDF inspection worksheet with both source PDF and draft JSON SHA-256. `--verify` accepts only checked review boxes and refuses stale/altered evidence, missing/ambiguous/out-of-range page references or incomplete review.
- `tools/add_lecture.py`: optional `--review-report`, `--source-pdf` and `--page-count` flags recheck the exact sources **before** lecture/catalog mutation; partial flag sets fail closed. Existing legacy `--write --reviewed` callers remain compatible; this does not make evidence checks mandatory for legacy imports or prove clinical accuracy.
- Generated worksheet approval is explicitly **before** registration: the final manual check says to confirm separate medical/editorial approval before any `--write --reviewed` operation.
- **Source-preservation boundary:** source lecture JSON and answer keys, original PDF figure bytes/hashes, IndexedDB progress and exam history, PWA/Worker configuration, and `main` are not edited by this implementation. Private PDFs are only hashed on the author's local device, never uploaded.
- **CI evidence:** exact head `4005d5290f64f47ce7738ef4b009687db2788755` passed GitHub Static, Chromium and WebKit in [run #42003586921](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42003586921). Additional registrar gating/test/docs changes require a **new final exact-head run**; previous green cannot be used as final-head proof.
- **Release HOLD:** do not merge/deploy until Cloudflare Workers Builds default deploy command has been confirmed build/upload-only, protected manual promotion (PR #81) is reviewed, and authenticated production smoke #35 / activation sequencing #50 are resolved. Build and browser suites do not constitute scientific editorial approval.
