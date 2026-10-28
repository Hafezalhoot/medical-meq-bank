# Medical MEQ Bank — Cross-project audit & delivery backlog

**Audit date:** 2026-10-26  
**Observed production source:** `dc3819f16b9bd9f6680d3ebe39246ce795710aa7` / app `2026.10.26.9`.  
**Live Cloudflare:** Worker `b873bcb3-067b-4478-8943-d354f46f2eff` at 100% traffic in scheduled read-only smoke, 2026-10-26 13:11 UTC.  
**Latest full main CI before this increment:** Static, WebKit and **151 Chromium** checks green, including layout, accessibility, exam, offline, print and progress. Authenticated live-browser smoke is **blocked** by Cloudflare Access HTTP 302, not a passing end-to-end live session.  
**V5.1 candidate branch:** `hardening/v5-safe-backup-restore-20261026` — do not mark as live before CI/merge/deployment verification.

## Architecture and preservation contract

- Vanilla HTML/CSS/JS progressive web application; native clinical lecture reader, image/spot source viewer and accessible Exam mode.
- Metadata-first `lectures/catalog.json`, separately downloaded `lectures/data/*.json`, registered `courses/catalog.json`; source content is not guessed from PDFs during runtime.
- Source-reviewed MCQ answer indices are required for auto-scored exams. Written answers are self-rated, not generatively scored.
- `src/progress-resilience.js` persists question ratings in IndexedDB with older saved-status migration; `src/pwa-client.js` manages backup/restore and optional offline lecture caching; separate media images are checked against source fingerprints.
- Cloudflare Workers Builds and protected GitHub Actions maintain application and static test gates. Cloudflare Access protects the production URL. The source repository being public does not make private study usage anonymous.

## Scientific content inventory — source-structure verification, not editorial regrading

The shipped `dist/lectures/catalog.json` lists **12** published lecture records:
- Surgery **9**: Urology 8, Neurosurgery 1.
- Internal Medicine II **3**: Dermatology 1, Psychiatry 2.
- Internal Medicine course exists in the registry but **0** published lectures.

Structural category totals across published JSON: **146 MEQ cases**, **441 core short items**, **109 image/spot questions**, **532 detailed short items**, **403 rapid recall entries**; these category entries may overlap in educational content and must not be advertised as unique questions. **138 source-answer-indexed MCQs** appear in exactly 3 currently reviewed lecture packs: Dermatology Introduction 30, Psychiatry History/MSE 52, Psychiatry Anxiety 56. The other 9 packs should not offer invented auto-scored MCQs.

All 12 referenced lecture JSON files and the audited locally referenced image asset paths existed in the production-built archive at inspection time. This does **not** certify whether every scientific assertion inside dense original lecture photographs has been extracted or whether 31 Bladder Cancer MCQs are clinically/editorially verified: those require comparison against the original lecture sources, especially [issue #53](https://github.com/Hafezalhoot/medical-meq-bank/issues/53).

## Findings, ranked by student impact

| ID | Severity | Evidence / user impact | Response / completion gate |
| --- | --- | --- | --- |
| A-01 | P1 | `src/pwa-client.js` invoked `replaceBackupTransactionally()` on file-input change, immediately replacing all current local ratings/preferences after schema validation. A valid but empty/old backup could wipe a student's active work with no review. | **V5.1 implemented candidate:** native preview modal, explicit confirmation, current vs. incoming/removed/changed counts, Cancel/Escape, one-click existing backup download; preserve rollback; test invalid/empty/legacy/current and failure paths. |
| A-02 | P1 | Production main build can activate Worker **before** main CI completes ([#50](https://github.com/Hafezalhoot/medical-meq-bank/issues/50)), even when GitHub's protected promotion workflow is correct. | Owner to set **Cloudflare production Deploy command** to `npx wrangler versions upload`; keep full-CI exact-version promotion; run a deliberate failing-check production hold test. Do not claim protected release solved by repository edits alone. |
| A-03 | P1 | Live read-only Cloudflare checks work, but protected production browser redirects 302 to Access; no authenticated service smoke credentials ([#35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35)). | Owner-approved scoped service token for smoke test, no Access bypass, then verify logged-in actual study and offline flow. |
| A-04 | P1 editorial | [#53](https://github.com/Hafezalhoot/medical-meq-bank/issues/53) remains open for Bladder Cancer source-checked MCQs. | Source lecture vs. authored keys, each figure's scientific content, exam-ready approval and source-linked editorial sign-off; no external medical guideline replacement. |
| A-05 | P2 | Public README described 10 lectures (actual catalog 12), and V5 progress board described V5.0 as an unpublished candidate after successful release. | V5.1 updated both with explicit shipped-vs-candidate states and actual lecture inventory. |
| A-06 | P2 | Connectivity pill used “Offline ready” whenever `navigator.onLine === false`, even if a user had never saved a subject offline. | Use neutral “Offline” state; separate offline-cache readiness per explicit lecture/download status. |
| A-07 | P2 | Feature code remains divided among large `src/app.js`, `src/print-manager.js`, exam, review, sidebars and nearly 127KB of base CSS with legacy cascade layers. Functional tests pass but maintenance/cross-breakpoint regression risk rises. | Narrow future refactor: extract reusable tokens/styles; reduce conflicting desktop/mobile overrides only after visual comparison and exact CI baseline. No wholesale rewrite, no new framework. |
| A-08 | P2 | Intake issues [#24](https://github.com/Hafezalhoot/medical-meq-bank/issues/24), [#25](https://github.com/Hafezalhoot/medical-meq-bank/issues/25) and [#26](https://github.com/Hafezalhoot/medical-meq-bank/issues/26) remain open: adding many lectures demands a repeatable source-verified pipeline. | Per lecture: ingest PDF + every informative image → explanation → reviewed source MCQs → original media references → atomic catalog registration → QA/screenshots, never auto-publish unreviewed content. |
| A-09 | P2 | Full generated distribution approx. 15 MB; this is the total installed artifact archive, **not measured initial network transfer or performance**. Some figures/device-private imports can depend on available storage. | Measure actual cold-start payload, render latency, image caching and storage pressure on iPhone before choosing an optimization; respect offline content protection. |

## Strengths to preserve

1. Lecture-first data provenance: JSON schema and source-linked original figures; no invented auto-scored clinical distractors.
2. Separate native source reader / clinical practice / Exam Mode, Weak-Review-Mastered, direct question navigation and user-owned backups.
3. V5 calming Mineral Blue visual system with dark theme, responsive paths, keyboard focus, print and accessibility tests.
4. Repeatable GitHub quality baseline: source/static, Chromium, WebKit, Workers Builds and independent read-only Worker traffic status.

## Next work packages

| Package | State | Acceptance |
| --- | --- | --- |
| P0/P1 Safe restore preview (A-01) | **IN PROGRESS** | Native dialog protects even valid/empty imports; old saved ratings untouched until confirm; own-backup download, cancel/Escape, 320px, rollback and v1/v2 test coverage |
| P1 Protected Cloudflare deployment (A-02) | **EXTERNAL ACTION REQUIRED** | Build-only upload setting verified and unsuccessful main checks never reach 100% |
| P1 Authenticated production smoke (A-03) | **EXTERNAL ACTION REQUIRED** | Scoped Access service credentials, independent browser result |
| P1 Source editorial review (A-04) | **TODO** | Compare the original lecture and mark question-by-question confidence before publication |
| P2 Lecture intake ergonomics (A-08) | **TODO** | A standard PDF+images → validated draft → preview → atomic insert workflow with tests |
| P2 CSS/dependency consolidation (A-07) | **TODO** | Remove duplicate styles and validate against screenshots, no behavior/data regression |
| P2 Performance and offline-depth QA (A-09) | **TODO** | Actual browser/network/storage evidence with device-sized figures, not a guess based on ZIP size |

## Release/evidence rules

- Never silently rewrite or invent medical content; clinical corrections need their primary lecture source and explicit editorial verification.
- Never change historical item IDs or medical image SHA-256 values during visual/UX work.
- Exact-head Static + Chromium + WebKit + Cloudflare Workers Builds must pass before merge.
- After merge, verify Worker ID at 100%; report Cloudflare Access limitations honestly. This last check is **not** equivalent to an authenticated study-session test.
- Keep this audit as a dated snapshot, and record later shipped increments in `MEQ_DESIGN_V5_PROGRESS.md` / `PROJECT_PROGRESS.md`.
