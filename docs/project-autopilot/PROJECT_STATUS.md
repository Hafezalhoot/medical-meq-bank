# My Medical Library — Project Autopilot status

## Product decision · 2026-11-04
Approved customer-facing brand **My Medical Library** with descriptor **Lectures · Questions · Exams**. The product is a **personal lecture-first medical learning library**, not an MEQ-only bank. MEQ is retained as an item type; all reviewed source content and privacy guarantees remain unchanged.

## Verified baseline
- Repository: `Hafezalhoot/medical-meq-bank`; default branch `main`; baseline commit `2f0d6e8d0e7daec4000cb41607d09b15e6d28d25` (V5.2, released source dated 2026-10-28).
- Source catalogs: 3 courses; 12 published lectures: Surgery 9 and Internal Medicine II 3. Only 3 lecture study packs contain published graded MCQs, 138 total.
- Other review types exist (MEQ cases, short answer, detailed, image/spot and Rapid Recall); *counts across question categories are not necessarily unique questions*.
- Storage: per-item IndexedDB ratings; local exam session/history; export/restore with replacement preview and rollback; existing PWA offline cache and generated standalone legacy HTML.
- Repository `README.md`, `AGENTS.md`, `DESIGN.md`, `CONTENT_AUTHORING.md` are authoritative for build and lecture content constraints.

## Work in progress
- GitHub issue [#74](https://github.com/Hafezalhoot/medical-meq-bank/issues/74) contains the approved pivot and implementation sequence LIB-00–LIB-06.
- Implementation PR [#75](https://github.com/Hafezalhoot/medical-meq-bank/pull/75) targets `main` from `feature/my-medical-library-v5-3-foundation-20261104`.
- Invariant: no changes to `lectures/`, `courses/`, original source images/hashes, stored ratings, IDs, backup schemas or exam scoring in the initial identity/accessibility slice.
- Initial branch scope: app branding/manifest/print/404 + safe browse-to-library affordance + identity/navigation regression tests.
- No production deploy or main merge is implied by an open PR.

## Quality gates
Static build, Chromium, axe, Safari/WebKit, Cloudflare Workers Build, source parity, offline and history/backup regressions must all pass on the exact final PR head before merge. Authenticated production smoke remains gated by Cloudflare Access [#35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35). Early Worker promotion issue [#50](https://github.com/Hafezalhoot/medical-meq-bank/issues/50) remains unresolved.

## Next unblocked tasks
1. Finish LIB-01 coherent identity/accessibility increment without expanding product infrastructure.
2. Run exact-head CI; diagnose failures rather than weakening thresholds. Verify no user-facing rename touched persistence.
3. After clean merge/release checks, implement reader-first course/lecture information architecture and the unified Question Bank, then pilot PDF intake with source page/image coverage.

## Evidence disclaimer
Current-turn GitHub connector reads and branch writes are verified. No local repo checkout was possible because external DNS/GitHub network access from the code container failed. GitHub Actions is used as the integration test runner. User-authenticated production UI has not been tested in this turn.
