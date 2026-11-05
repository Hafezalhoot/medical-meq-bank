# My Medical Library — Project Autopilot status

## Owner-approved product direction
**My Medical Library · Lectures · Questions · Exams** is the personal lecture-first medical study application; MEQ is one supported question type, not the overall brand. Lecture-First Policy still controls every exam fact, and explanatory additions must be labeled as aids, not new exam facts.

## Repository and release baseline
- Repository: `Hafezalhoot/medical-meq-bank`; production source branch `main` is at `cb0d193c447623b5b52784ab6d5e73d4275f400e` (V5.9 code merged, not proof of active production Worker).
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


## 2026-11-05 — Proposed V6 information architecture / design audit

- User requested structural redesign of **the entire library navigation**, the stacked Lecture/Topic workflow and future Course/Subject/Chapter/Lecture authoring, not a shallow re-color.
- Source reviewed: main \`cb0d193c447623b5b52784ab6d5e73d4275f400e\`; CI rendered evidence: 22 screenshots in [Chromium run #42007867391](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/42007867391). Independent authenticated production browsing was not available; browser call to preview blocked externally.
- Source diagnoses: one stacked view hierarchy, course/subject/lecture/topic but no chapters, CLI-based medical intake; app CSS ~132 KB with ~93 media blocks, app JS ~85 KB. These are audit observations, not claims that all functions failed.
- **Proposed only:** \`docs/superpowers/specs/2026-11-05-my-medical-library-v6-information-architecture-design.md\`; \`design-system/my-medical-library/MASTER.md\`; \`docs/superpowers/plans/2026-11-05-my-medical-library-v6-execution.md\`; \`docs/project-autopilot/ROADMAP.md\`.
- Status: no V6 UI source code changed, no Chapter schema changed, no new runtime design library or ChatGPT web skill installed, no new production Worker activated by this planning branch.
- Next: owner reviews direction; UX-01 router/screens pilot; verify responsive/keyboard and source/progress invariants before moving to Library/Chapter and then Reader/Authoring slices.
