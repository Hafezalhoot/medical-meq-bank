# Medical MEQ Bank — Project Progress & Scalability Program

> **Single source of truth for the modernization program.**
>
> Update this file in the same branch/PR whenever a task is completed, blocked, re-scoped, or newly discovered. Do not mark an item complete until its acceptance criteria are satisfied and the relevant automated checks pass.

## Program snapshot

- **Repository:** `Hafezalhoot/medical-meq-bank`
- **Working branch:** `hardening/scalability-overhaul-20261003`
- **Baseline commit:** `ae7d0b47b89236a9b152a3083c422779946a41b1`
- **Started:** 2026-10-03
- **Release candidate:** `2026.10.04.2`
- **Delivery PR:** `#19` (`hardening/scalability-overhaul-20261003` → `main`)
- **Primary goal:** preserve the current reliable PWA and study UX while removing the architectural ceilings that would prevent safe growth to many courses, subjects, lectures, study items, images, and users.
- **Non-goal:** framework churn. React/Next.js/Supabase are not introduced unless a measured requirement cannot be met by the existing platform and data model.

## Status legend

| Status | Meaning |
| --- | --- |
| ✅ Done | Implemented and verified |
| 🟦 In progress | Actively being changed in the current branch |
| ⏳ Planned | Accepted work, not started yet |
| ⚠️ Blocked | Needs external configuration, permission, or a decision |
| 🧪 Verify | Code is present but still requires full CI/browser confirmation |

## Release candidate status

| Gate | Status | Evidence / note |
| --- | --- | --- |
| Source architecture refactor | ✅ Pass | Lecture-level loading, bounded rendering, selective offline caching, per-item progress, scoped search and generic authoring pipeline are implemented on PR #19 |
| Repository hygiene | ✅ Pass | Recursive Git tree contains no tracked `dist/`, `tmp/`, test results, Playwright reports, Python caches, or bytecode |
| JavaScript source syntax | ✅ Pass | All shipped runtime JavaScript files parse successfully in an independent V8 syntax pass |
| Version consistency | ✅ Pass | `version.json`, service worker, and PWA client all declare `2026.10.04.2` |
| Content/catalog invariants | ✅ Pass | 9 unique lecture IDs; course/subject order is unique; every catalog entry has course + payload version metadata |
| Surgery compatibility baseline | ✅ Pass | All 9 current Surgery lectures are protected by the common baseline, including Renal Tumors |
| Dependency lock consistency | ✅ Pass | `package.json` and `package-lock.json` agree on Playwright 1.62.1 and axe-playwright 4.13.0 |
| Full clean build | ✅ Pass | GitHub Actions run `37190596970` on `2026.10.04.2` completed successfully; `validate` built from clean sources and passed the canonical static quality gate |
| Chromium + axe + performance + print + offline | ✅ Pass | `chromium-quality` passed in run `37190596970`, including accessibility, performance, print/PDF, offline, progress and regression coverage |
| WebKit / iPhone | ✅ Pass | `webkit-quality` passed in run `37190596970` for Safari desktop and iPhone WebKit smoke coverage |
| Main branch protection | ⚠️ External configuration | Repository is public and personal-account owned, but repository rulesets are currently empty; configure required PR/status checks on `main` per issue #21 |
| Cloudflare production URL / Access / branch control | ⚠️ External verification | No Cloudflare connector is available; verify these settings in the Cloudflare dashboard before promotion |
| Production merge/promotion | ⛔ Hold | Quality matrix is green; PR #19 remains draft until `main` protection and Cloudflare production controls are verified |

Resolved runner recovery tracker: https://github.com/Hafezalhoot/medical-meq-bank/issues/20

## Current production baseline

### Strengths already present

- Offline-first PWA shell and standalone offline build.
- Reviewable JSON lecture sources with catalog count validation.
- Course → subject → lecture configuration layer.
- Strong CSP/security headers for a static application.
- Chromium, WebKit/iPhone, accessibility, layout, offline, print, progress-recovery, and performance regression tests.
- Progress backup/import validation and IndexedDB corruption recovery.
- Cloudflare production build integration.

### Risk register

| ID | Status | Severity | Area | Current state |
| --- | --- | --- | --- | --- |
| R-001 | ✅ Resolved in RC | Critical | Offline/PWA | Mandatory install cache no longer contains the full lecture bank; lecture/subject offline storage is selective. |
| R-002 | ✅ Resolved in RC | Critical | Data loading | Subject navigation is metadata-first and the selected lecture payload is loaded on demand. |
| R-003 | ✅ Resolved in RC | Critical | Rendering | The DOM is bounded to the active lecture; All Lectures uses lightweight overview cards. |
| R-004 | ✅ Controlled | Critical | Offline export | Full-bank standalone HTML remains only as a backward-compatible export with an 8 MB hard ceiling. |
| R-005 | ✅ Resolved in RC | High | Progress | Progress is stored as per-item IndexedDB records with legacy migration and transactional backup/restore. |
| R-006 | ⚠️ External configuration | High | Release safety | GitHub Actions is restored and the full matrix is green; `main` branch protection and Cloudflare production controls remain to be verified before promotion. |
| R-007 | ✅ Resolved in RC | High | Identity model | Course/subject/lecture/item scoped identity and v2 progress keys prevent practical cross-course collisions. |
| R-008 | ✅ Resolved | High | Content pipeline | Generic materialization/publishing and one-command authoring replace lecture-specific code. Verified legacy source transport inputs remain as reproducible data inputs, not lecture-specific build logic. |
| R-009 | ✅ Resolved | High | Repository hygiene | Generated `dist/`, browser reports, caches and bytecode are not tracked and are rejected by hygiene checks. |
| R-010 | ✅ Resolved in RC | Medium | Search | Search uses build-time course+subject shards and can find unloaded content without rendering the corpus. |
| R-011 | ✅ Controlled | Medium | Schema | Payload v1 and catalog metadata versions are explicit/fail-closed; speculative rich-block schema migration is intentionally deferred. |
| R-012 | ✅ Resolved | Medium | Documentation | README, deployment, release, content-authoring, UI design-system and progress documents reflect the current architecture. |
| R-013 | ✅ Resolved | Medium | Regression baseline | All 9 current Surgery lectures use the same compatibility baseline. |
| R-014 | ✅ Resolved | Medium | PR hygiene | Superseded PR/dependency noise was cleared; PR #19 is the sole modernization delivery track. |
| R-015 | ✅ Resolved in RC | Low | UI consistency | Structural control glyphs use a shared inline-SVG language and the Clinical Study Workspace design system. |
| R-016 | ⚠️ External verification | High | Cloudflare | Exact public hostname, Access policy and branch-control/promotion settings require Cloudflare dashboard verification. |
| R-017 | ⏳ Deferred by trigger | Medium | Multi-device users | Accounts/backend sync are not required for content scalability; introduce only when cross-device sync/admin roles become product requirements. |

## Target architecture

```text
Course catalog
  -> Subject catalog metadata
      -> Lecture metadata
          -> Fetch one selected lecture on demand
              -> Render selected lecture only
                  -> Cache lecture after use / explicit offline pack
                      -> Store per-item progress in IndexedDB
```

### Design principles

1. **Metadata first, payload second.** Navigation must not require downloading full lecture payloads.
2. **Render only what the learner is using.** Hidden content should not remain as thousands of DOM nodes.
3. **Offline is selective, not mandatory full-bank download.** App shell is always offline-ready; lecture/subject packs are cached on demand.
4. **Stable canonical IDs.** IDs survive reordering, content growth, and course expansion.
5. **One content ingestion contract.** Lecture 500 must be added the same way as lecture 5.
6. **CI before production.** A failed quality gate must never produce a promoted production release.
7. **Preserve current user data.** Every storage/schema change requires a backward-compatible migration or fallback.
8. **No unnecessary framework migration.** Keep the smallest architecture that meets measured requirements.

## Delivery phases

### Phase 0 — Baseline, tracking, and release safety

**Goal:** establish a clean controlled modernization branch and stop unverified production changes.

- ✅ P0-01 Create modernization branch.
- ✅ P0-02 Add this persistent progress log.
- ✅ P0-03 Reproduce and diagnose the failing `main` validation path.
- ✅ P0-04 Keep deployment/readme references aligned with the current personal repository owner and Cloudflare Workers setup.
- ✅ P0-05 Tighten repository hygiene checks to reject all Playwright report variants; generated `dist/` cleanup remains in Phase 8.
- ✅ P0-06 Remove tracked generated artifacts from source control — `dist/`, temporary outputs, and Playwright reports are no longer tracked; hygiene rejects their return.
- ⚠️ P0-07 CI quality gates are restored and the complete matrix is green in run `37190596970`; enforcing those checks as non-bypassable `main` branch protection and confirming Cloudflare branch control remain external configuration tasks.
- ✅ P0-08 Clean superseded open PRs and dependency noise — only modernization PR #19 remains open; locked Playwright/axe tooling was updated on the branch.
- ⚠️ P0-09 Record and verify the canonical production URL/access policy — Worker identity is confirmed, exact public hostname and Cloudflare Access policy still require Cloudflare dashboard verification.

**Acceptance criteria**
- Current branch builds from clean sources.
- Validation, Chromium, and WebKit jobs pass.
- Production deployment cannot be promoted from a failing commit.
- Operational docs match the real repository/deployment model.

### Phase 1 — Lecture-level loading and bounded rendering

**Goal:** make application cost depend on the selected lecture rather than total subject size.

- ✅ P1-01 Split catalog metadata/navigation from lecture payload loading — implemented; verified by the green browser matrix in run `37190596970`.
- ✅ P1-02 Add `loadLecture(lectureId)` with deduplicated in-flight requests — implemented; verified by the green browser matrix in run `37190596970`.
- ✅ P1-03 Keep `loadSubject` metadata-first and compatibility-safe — implemented; it loads metadata plus only the active lecture payload.
- ✅ P1-04 Render the selected lecture only — implemented and protected by new DOM-budget tests.
- ✅ P1-05 Change “All lectures” into a lightweight overview rather than full-card rendering — implemented with accessible overview buttons.
- ✅ P1-06 Preserve navigation, random item, filtering, metadata-based progress counts, scoped printing, and accessibility behavior — code adapted; the full browser matrix passed in run `37190596970`.
- ✅ P1-07 Add regression tests proving inactive lectures are not fetched/rendered — implemented in performance/course-pack/hardening tests.
- ✅ P1-08 Scale behavior is enforced by bounded one-lecture DOM/request budgets and metadata-only navigation tests; a synthetic massive fixture is deferred unless measured regressions justify the maintenance cost.

**Acceptance criteria**
- Initial active-course load fetches catalog + at most the selected lecture payload.
- Switching lectures fetches only the newly selected lecture.
- DOM node count is bounded by the active lecture rather than subject size.
- Existing study interactions continue to pass Chromium/WebKit/a11y tests.

### Phase 2 — PWA/offline caching v2

**Goal:** remove full-corpus pre-cache while keeping excellent offline behavior.

- ✅ P2-01 Pre-cache app shell/catalog/runtime/icons without lecture payloads or the monolithic offline export — implemented.
- ✅ P2-02 Runtime-cache successful lecture JSON/assets after use — implemented through the existing cache-first asset handler.
- ✅ P2-03 Add explicit offline download/remove APIs and UI for a lecture — implemented.
- ✅ P2-04 Add optional subject-pack offline download using catalog metadata — implemented.
- ✅ P2-05 Keep versioned caches and stale-cache cleanup — retained and now used by selective caching.
- ✅ P2-06 Add selective cache/install regression coverage; browser verification passed in run `37190596970`.
- ✅ P2-07 Keep the monolithic standalone file only as a bounded legacy export — an 8 MB hard ceiling now prevents it becoming the scalable delivery path; selective PWA lecture/subject downloads are the supported growth path.
- ✅ P2-08 Offline cache failures (including storage/network failures) are caught and surfaced through the existing toast/control feedback; verified by the green browser matrix in run `37190596970`.

**Acceptance criteria**
- Service-worker install succeeds without downloading every lecture.
- Previously opened/downloaded lectures work offline.
- A single unavailable lecture does not break PWA installation.
- Corpus growth does not increase mandatory first-install bytes linearly.

### Phase 3 — Progress storage v2

**Goal:** make progress writes scale per changed item and preserve existing users.

- ✅ P3-01 Define the v2 per-item progress record schema — implemented in IndexedDB `progress-items`; canonical content namespacing continues in Phase 4.
- ✅ P3-02 Promote IndexedDB to primary per-item progress storage — implemented.
- ✅ P3-03 Migrate legacy `medicalBankStatusV2` safely on first run — implemented; legacy blob is removed only after successful IndexedDB hydration.
- ✅ P3-04 Keep localStorage only for small UI preferences — implemented for progress writes.
- ✅ P3-05 Add backup schema v2 with pre-read size limits, transactional import/rollback, and v1 compatibility — implemented.
- ✅ P3-06 Preserve explicit reset semantics and legacy corruption recovery — implemented around the v2 store.
- ✅ P3-07 Add migration, reset, per-item write, v1 rejection, v2 import and rollback-oriented regression tests — implemented; the regression suite passed in run `37190596970`.

**Acceptance criteria**
- Rating one item writes one progress record, not the full bank state.
- Legacy progress appears unchanged after migration.
- Import/export and corruption recovery remain transactional.

### Phase 4 — Canonical content identity and schema v2

**Goal:** support multiple courses/curricula/editions without collisions or inconsistent payloads.

- ✅ P4-01 Define canonical scoped identity rules: course / subject / lecture / item — implemented through `subjectScope`, `lectureScope`, `itemScope`, and v2 progress keys.
- ✅ P4-02 Add schema versioning to catalogs and lecture payloads — every catalog entry now declares `schemaVersion: 1`; unsupported versions are rejected by runtime/build validators.
- ✅ P4-03 Typed-block rewrite deliberately deferred — current case/core/image/extra/rapid v1 structures remain the stable contract until a real rich-content requirement justifies migration.
- ✅ P4-04 Image/media integrity metadata remains enforced for materialized AVIF content; broader asset-reference migration is deliberately deferred until embedded-media size is a measured bottleneck.
- ✅ P4-05 No speculative content migration utility is shipped: payload v1 is explicit and fail-closed; a deterministic migration becomes mandatory only when a real payload v2 is introduced.
- ✅ P4-06 Validators now enforce scoped subjects, globally unique lecture IDs, supported schema versions, catalog counts, search identities, and generic materialization contracts.
- ✅ P4-07 Legacy progress keys lazily migrate to canonical course/subject/lecture/type/item v2 keys without discarding existing ratings.

**Acceptance criteria**
- Duplicate local IDs across different courses cannot collide.
- Every published payload has an explicit schema version.
- Invalid content fails at build time with an actionable error.

### Phase 5 — One content ingestion pipeline

**Goal:** remove lecture-specific build logic.

- ✅ P5-01 Define one canonical lecture build contract — `lectures/materialization.json` is now the single declaration for generated lecture sources while ordinary lectures remain reviewable JSON under `lectures/data`.
- ✅ P5-02 Fold renal/urolithiasis/bladder materialization into generic tooling — implemented by `tools/materialize_lectures.py`; the materializer and image validator are data-driven and contain no target lecture IDs.
- ✅ P5-03 Retain the verified legacy compressed/template source inputs as reproducible data inputs. The generic materializer passed the fresh full matrix in run `37190596970`; rewriting or deleting validated medical source transport data is intentionally avoided unless a provenance-preserving canonical replacement is introduced.
- ✅ P5-04 Materialization checksums and search metadata are generated/validated from source; lecture catalog metadata remains explicit for reviewability.
- ✅ P5-05 Unified Surgery compatibility protection — all 9 current lectures, including Renal Tumors, use the same baseline path; the renal-specific validator exception was removed.
- ✅ P5-06 Added `tools/add_lecture.py` with dry-run/write modes plus `CONTENT_AUTHORING.md` as the contributor workflow.
- ✅ P5-07 Legacy compressed/template targets retain their raw-byte/SHA-256 and image-integrity contracts. Historical workflow `30875638166` passed validate + 33 Chromium tests + 2 WebKit tests and validated all 24 embedded AVIF images on the pre-modernization content baseline. Shared catalogs are now course-scoped; the refactored generic engine passed the fresh full matrix in run `37190596970`.

**Acceptance criteria**
- No runtime/build pipeline script names a specific lecture ID.
- Adding a lecture uses the same steps regardless of specialty.
- Existing lecture content/counts/images are preserved and validated.

### Phase 6 — Search and navigation scalability

**Goal:** search the content corpus without rendering it.

- ✅ P6-01 Create compact build-time search metadata — implemented as course+subject shards plus a tiny search catalog; embedded image/base64 payloads are explicitly excluded.
- ✅ P6-02 Search lecture/item metadata independently of active DOM — implemented.
- ✅ P6-03 Load a lecture payload only when its search result is opened — implemented and covered by a regression test.
- ✅ P6-04 No Web Worker added yet by design; per-subject shards cap the working set and a worker remains a measured-performance upgrade, not speculative complexity.
- ✅ P6-05 Search results use real buttons, visible focus, live result counts, actionable empty-state guidance, responsive layout, and reduced-motion-aware scrolling; full a11y verified by the green browser matrix in run `37190596970`.
- ✅ P6-06 Added search-shard size budgets plus request/DOM/result-count regressions; end-to-end browser coverage passed in run `37190596970`.

**Acceptance criteria**
- Search can find content in unloaded lectures.
- Search latency does not scale with rendered DOM size.
- Opening a result loads only the required lecture.

### Phase 7 — UI/UX polish after architecture is stable

**Goal:** improve quality without hiding architecture problems with styling.

- ✅ P7-01 Added skip navigation, unified visible focus, ≥44px primary interaction targets, safe-area padding, phone-landscape coverage, reduced-motion-aware scrolling, and scroll-margin protection from sticky controls.
- ✅ P7-02 Replaced structural emoji/text control glyphs in the main app and Print Center with a consistent inline SVG stroke language.
- ✅ P7-03 Added a delayed skeleton for lecture loading so quick loads do not flash an indicator while slower loads receive visible feedback.
- ✅ P7-04 Offline lecture/subject actions expose busy/cached state and distinguish quota/session/network failure guidance.
- ✅ P7-05 Dark mode retains semantic tokens; primary/muted/brand/revision-state foreground/background pairs pass static WCAG AA contrast calculations, with axe verification now green in run `37190596970`.
- ✅ P7-06 Axe, keyboard, Chromium and iPhone/WebKit coverage passed in GitHub Actions run `37190596970`.
- ✅ P7-07 Reworked page hierarchy into a Clinical Study Workspace: compact header, explicit Course → Specialty → Lecture breadcrumb, search-first toolbar, progress-priority stats, bounded reading width, quieter navigation surfaces, and stable card elevation.
- ✅ P7-08 Added lecture-level rated-progress cues to the All Lectures overview so the learner can choose Start vs Continue without opening every lecture.
- ✅ P7-09 Added `UI_DESIGN_SYSTEM.md` and `UI_UX_AUDIT.md` so future courses/features reuse the same hierarchy, spacing, responsive, accessibility, and component language.
- ✅ P7-10 Added regression tests for redesigned heading, semantic progress bars, breadcrumb orientation, empty-state recovery, Print Center target size, mobile targets, and landscape overflow.

### Phase 8 — Repository and operations hardening

**Goal:** make long-term maintenance predictable.

- ✅ P8-01 `dist/`, temporary outputs and Playwright reports are not tracked; repository hygiene blocks them.
- ✅ P8-02 CI uploads generated site/browser reports as short-lived 7-day artifacts.
- ✅ P8-03 Added `RELEASE_PROCESS.md` and release candidate `2026.10.04.2`; version/cache synchronization is build-validated.
- ✅ P8-04 CODEOWNERS was deliberately not added: there is no demonstrated multi-reviewer ownership need, so the repository stays simpler.
- ✅ P8-05 Updated locked Playwright/axe tooling and cleared stale dependency PR noise; only PR #19 is open.
- ✅ P8-06 Rollback and production-promotion policy is documented in `RELEASE_PROCESS.md` and `DEPLOYMENT.md`.
- ⚠️ P8-07 Repository visibility is intentionally public under `Hafezalhoot`; exact production hostname, active Cloudflare Access policy and production branch control still require Cloudflare dashboard verification.

### Phase 9 — Optional multi-device/user platform

**Trigger:** only when accounts, cross-device sync, analytics, centralized authoring, or access roles are actually required.

- ⏳ P9-01 Define authentication/privacy requirements.
- ⏳ P9-02 Introduce backend sync for progress with offline conflict handling.
- ⏳ P9-03 Add admin/content workflow if manual Git authoring no longer scales.
- ⏳ P9-04 Add observability that does not collect unnecessary student data.

**Note:** no backend is required to solve the present content-scaling bottlenecks.

## Verification matrix

Every phase should preserve or improve these checks:

| Capability | Required verification |
| --- | --- |
| Build integrity | `bash build.sh` + Python validators |
| JavaScript integrity | `node --check` on source/generated runtimes |
| Chromium behavior | Playwright E2E |
| Safari/iPhone behavior | Playwright WebKit |
| Accessibility | axe WCAG A/AA + keyboard/focus behavior |
| Offline | service-worker + offline navigation tests |
| Data integrity | schema/count/ID/subtopic/image validation |
| Progress safety | migration/import/reset/corruption tests |
| Performance | request, DOM-node, interaction, bundle/asset budgets |
| Security | CSP/header audit and no unsafe runtime regressions |

## Change log

### 2026-10-04 — Personal-account migration and CI recovery

- ✅ Transferred the public repository from the `Hafez-Alhoot` organization to personal account `Hafezalhoot` while preserving repository ID, history, PR #19, issues and branches.
- ✅ GitHub-hosted runners began provisioning normally after the transfer; issue #20 is resolved. The exact organization-side policy that caused the former zero-job `BuildFailed/startup_failure` was not identified.
- ✅ Release candidate `2026.10.04.2` passed the complete GitHub Actions matrix in run `37190596970`: `validate`, `chromium-quality`, and `webkit-quality`.
- ✅ Fixed stale search-runtime validation and aligned Chromium/WebKit tests with metadata-first one-lecture loading and course/subject search shards.
- ✅ Fixed mobile filter reset so it clears stale global-search results.
- ✅ Raised breadcrumb label contrast to pass automated WCAG A/AA checks.
- ✅ Prevented an unnecessary page reload on first service-worker installation while retaining reload behavior for real service-worker updates.
- ✅ Hardened Print Center regression timing so PDF/pagination assertions wait for completed pagination.
- ✅ Removed the temporary hosted-runner probe and the Python invalid-escape warning from the build.
- ✅ Retained verified legacy compressed/template source inputs intentionally as reproducible data inputs; the generic content engine is the only build path and passed the full matrix.
- ⚠️ Final release blockers are configuration-only: protect `main` with required quality checks (#21) and verify Cloudflare production hostname/Access/branch control.
- ✅ Documentation was reconciled after the repository became public and moved to `Hafezalhoot`; README, deployment, release, Actions incident, and UI/UX audit docs no longer describe the old private-organization state as current.


### 2026-10-03 — Release candidate UI and operations hardening
- ✅ 2026-10-04: repository visibility changed from private to public to enable the free public-repository CI/protection path; a fresh Actions run is required to verify whether the previous pre-job startup blocker is cleared.
- ✅ 2026-10-04 follow-up: hardened backup failure reporting so a failed automatic rollback no longer claims that current progress was preserved; failure injection now covers the partial-rollback case explicitly.
- ✅ 2026-10-04 follow-up: bumped the release candidate and PWA cache identity to `2026.10.04.1` after runtime changes, keeping `version.json`, service worker, and PWA client synchronized.
- ⚠️ 2026-10-04 follow-up: release-candidate commit `6134522ba2ef49abc3077bccc26cf7feec85af0a` remains mergeable-clean, but run `37161592860` still fails before job creation; code-side release work is therefore complete pending external runner/Cloudflare controls.
- ✅ 2026-10-04 follow-up: removed the last lecture-specific generated-file assertion from `scripts/quality_gate.sh`; published lecture completeness is validated generically from `lectures/catalog.json`.
- ✅ 2026-10-04 follow-up: converted `scripts/validate_lecture_images.py` from three hard-coded Urology lecture IDs to data-driven AVIF/hash/count validation backed by `materialization.json` and asset manifests.
- ✅ 2026-10-04 follow-up: added failure-injection coverage proving backup import rolls back both IndexedDB progress and local preferences if progress replacement fails mid-restore.
- ✅ 2026-10-04 follow-up: extended Print Center coverage to render the generated worksheet as an actual A4 PDF and verify a valid non-empty PDF payload.
- ✅ 2026-10-04 follow-up: audited the complete shipped runtime/build tool set after these fixes; no specific lecture IDs remain hard-coded in runtime or build pipeline scripts.
- ⚠️ 2026-10-04 follow-up: latest Actions run `37161474808` on `bfaf589960e2dbc1e0196c605bdca314dac1e822` still fails as synthetic `BuildFailed/startup_failure` with zero jobs; PR #19 remains draft and mergeable-clean.
- ✅ 2026-10-04 follow-up: aligned `CONTENT_AUTHORING.md` with the canonical `npm run quality:static`, `npm run test:e2e`, and `npm run test:webkit` release commands so lecture onboarding no longer duplicates stale validator steps.
- ⚠️ 2026-10-04 follow-up: the documentation-only commit `96bf11fb023fb3545b89c08d599cd053f42301b0` triggered Actions run `37161202301`, which again failed as synthetic `BuildFailed/startup_failure` with zero jobs, confirming the blocker persists independently of application code.
- ✅ Finalized a canonical local/CI static gate: `npm run quality:static` → `build.sh` → `scripts/quality_gate.sh`; build creates `dist/` first, then validators/performance/repository/JS checks execute exactly once.
- ✅ Added shared `npm run test:webkit` and aligned README + GitHub CI with the same command.
- ✅ Updated README lecture onboarding to use `tools/add_lecture.py` dry-run/write flow instead of manual multi-file edits.
- ⚠️ GitHub public Status reported Actions operational while this private repository continued returning zero-job `BuildFailed/startup_failure`; the remaining runner blocker is therefore account/organization/repository-specific rather than a broad Actions outage.
- ✅ Consolidated duplicate CI/static validation into one canonical static quality gate used by `build.sh`, npm, Cloudflare and GitHub CI; added performance-budget enforcement to deployment builds.
- ✅ Matched both Playwright Docker images to the locked `@playwright/test` version `1.62.1`.
- ✅ Added `ACTIONS_RECOVERY.md` with the minimal-probe evidence, organization billing/policy checks, and GitHub Support escalation identifiers.
- ⚠️ Minimal hosted-runner probe commit `705338e64d86e1755999b3e1b559786aca5b6f72` produced run `37140311659` with the same synthetic `BuildFailed/startup_failure` and zero jobs, excluding app/build/npm/Playwright code as the cause.
- ✅ Isolated the Actions failure with a native runner-only smoke job (no checkout, marketplace action, container, Node, Python, or project code); it still returned synthetic `BuildFailed/startup_failure` with zero jobs, proving the remaining CI fault is above repository execution.
- ✅ Removed all diagnostic smoke workflows after isolation, restored the full Chromium/WebKit quality matrix, aligned the Playwright container with locked `1.62.1`, and centralized static checks in `scripts/quality_gate.sh` / `npm run quality:static`.
- ⚠️ Exact remediation is now documented in `RELEASE_PROCESS.md`: organization Actions enablement, standard hosted-runner policy, action allowlist/SHA policy, execution protections, and private-repository billing/usage must be checked by an organization administrator.
- ⚠️ GitHub Actions latest evidence: run `37139094282` reports blank workflow name, `path: BuildFailed`, `(Unknown event)`, `startup_failure`, and contains zero jobs and zero artifacts; no repository test step starts.
- 🧪 Final UI release candidate `2026.10.04.1` includes the Clinical Study Workspace hierarchy, lecture-overview progress, semantic active states, unified vector icon language, filter recovery, and design-system documentation.
- ✅ Completed the Clinical Study Workspace redesign using the UI/UX design-system audit: compact header, content-first hierarchy, breadcrumb orientation, progress-priority dashboard, bounded reading width, lower visual noise, and stable interactions.
- ✅ Added lecture progress to the overview, direct empty-state recovery, associated filter labels, semantic progressbar states, and sticky-focus protection.
- ✅ Added permanent `UI_DESIGN_SYSTEM.md` + `UI_UX_AUDIT.md`; no new framework, UI library, font request, or animation dependency was introduced.
- ✅ Fixed shared-catalog validation so each course validates only its own `courseId` entries while preserving global lecture-ID uniqueness; this removes a blocker to the first Internal Medicine lecture.
- ✅ Independent static release audit passed repository hygiene, runtime JavaScript parsing, version synchronization, catalog identity/order checks, 9/9 Surgery baseline coverage, and package/lock dependency consistency.

- 🧪 Prepared release candidate `2026.10.04.1` and synchronized `version.json`, PWA client, and service-worker cache identity.
- ✅ Removed generated `dist/`, temporary build output, and browser reports from tracked source; CI keeps artifacts for 7 days.
- ✅ Added `CONTENT_AUTHORING.md`, `RELEASE_PROCESS.md`, and README operation links.
- ✅ Added one-command lecture dry-run/registration tooling and unified the Surgery regression baseline across all 9 current lectures.
- 🧪 Added skip navigation, consistent focus treatment, safe-area padding, 44px primary controls, delayed lecture skeleton, improved offline error feedback, and course-scoped search/offline behavior.
- ✅ Replaced main structural emoji controls and Print Center emoji icons with inline SVG controls.
- 🧪 Made Rapid Recall keyboard-operable with semantic buttons and `aria-expanded`; added dark-mode restoration, phone-landscape, and touch-target regressions.
- ⚠️ GitHub Actions still ends with synthetic `BuildFailed/startup_failure` before any job is created, so the full Chromium/WebKit/a11y matrix remains unexecuted.
- ⚠️ No Cloudflare plugin/connector is available in this environment; exact production hostname, Access policy, and production branch-control setting remain external verification items.


### 2026-10-03 — Scoped identity, generic ingestion, and scalable search

- 🧪 Added canonical scoped identity through the Course Registry: course → subject → lecture → type → item.
- 🧪 New progress records use scoped v2 keys; legacy keys migrate lazily when encountered.
- 🧪 Added explicit `schemaVersion: 1` to every lecture catalog entry and fail-closed runtime/build validation for unsupported versions.
- ✅ Kept the existing medical content structures instead of performing a speculative typed-block rewrite that would churn verified content without a current product need.
- 🧪 Added `lectures/materialization.json` and one generic `tools/materialize_lectures.py` engine for compressed-parts and template+asset sources.
- ✅ Removed the three lecture-specific Python materializer scripts; the generic tool contains no hard-coded target lecture ID.
- 🧪 Preserved the original raw-byte, SHA-256, repair-chunk, AVIF byte-count, and AVIF hash contracts in data rather than lecture-specific code.
- 🧪 Added per-subject search shards generated at build time; image/base64 payload fields are excluded from indexing.
- 🧪 Global search can find unloaded lecture items and only loads the selected lecture after result activation.
- 🧪 Added search-shard completeness/duplicate/size/image-payload validation and request/DOM regression coverage.
- 🧪 Improved search focus, empty-state, mobile, and reduced-motion behavior.

### 2026-10-03 — Bounded legacy offline export

- 🧪 Reclassified the self-contained full-bank HTML as a backward-compatibility export rather than the scalable offline architecture.
- 🧪 Added an 8 MB hard build/finalization ceiling so corpus growth cannot silently turn the legacy file into an unbounded download.
- 🧪 Documented selective PWA lecture/subject downloads as the supported scalable offline path.
- 🧪 Updated performance budgets and README storage/offline descriptions to match the new architecture.

### 2026-10-03 — Per-item progress storage implementation

- 🧪 Upgraded IndexedDB to schema version 2 with a dedicated `progress-items` store.
- 🧪 Added one-record `set/delete` progress writes instead of serializing the complete bank on every rating click.
- 🧪 Added automatic first-run migration from the legacy `medicalBankStatusV2` localStorage blob.
- 🧪 Added state hydration before the initial lecture payload is rendered.
- 🧪 Added explicit IndexedDB clear/reset semantics.
- 🧪 Added backup schema v2 with separate preferences/progress sections, 16 MB pre-read safety limit, transactional rollback, and legacy v1 import compatibility.
- 🧪 Updated migration/reset/corruption/backup tests.
- ✅ `app.js`, `lecture-loader.js`, `progress-resilience.js`, `pwa-client.js`, `print-manager.js`, and `service-worker.js` all pass source-level JavaScript syntax parsing.

### 2026-10-03 — Lecture loading and selective offline implementation

- 🧪 Reworked `src/lecture-loader.js` into metadata-first, lecture-level loading with deduplicated in-flight payload requests.
- 🧪 Reworked `src/app.js` so the DOM contains only the active lecture; “All lectures” now renders lightweight metadata overview cards.
- 🧪 Subject totals/progress can be calculated from catalog expected counts without loading every lecture body.
- 🧪 Updated the Print Center so opening it no longer triggers an implicit full-bank download.
- 🧪 Removed lecture JSON and the monolithic standalone HTML from mandatory service-worker installation pre-cache.
- 🧪 Added selective lecture cache/remove APIs and optional subject offline download.
- 🧪 Added visible lecture/subject offline controls with 44px minimum interaction targets.
- 🧪 Added/updated regression tests for one-payload startup, one-lecture DOM bounds, metadata-only catalogs, selective offline caching, sequential image verification, and isolated broken-lecture behavior.
- ✅ Source-level JavaScript syntax was checked during the refactor; full build/Chromium/WebKit execution remains blocked by the external GitHub Actions startup failure and the current container has no outbound GitHub network.

### 2026-10-03 — Phase 0 hardening pass

- ✅ Opened draft PR #19 as the delivery track for the modernization program.
- ✅ Reproduced the current GitHub Actions failure on the modernization branch and PR.
- ✅ Confirmed the failure signature is pre-job: empty workflow name, path `BuildFailed`, `startup_failure`, and zero jobs. No repository build/test code executes in this state.
- ✅ Updated deployment documentation from stale Pages instructions to the current Cloudflare Workers setup; later ownership/visibility changes are recorded in the 2026-10-04 entry.
- ✅ Added release/rollback guidance and documented that Cloudflare production promotion must remain gated by the validation matrix.
- ✅ Hardened repository hygiene to reject all `playwright-report*` variants.
- ✅ Removed the tracked `playwright-report-webkit/index.html` artifact.
- ✅ Updated README lecture inventory to include Renal Tumors and linked the modernization/deployment sources of truth.
- ✅ Closed stale PR #17 as superseded by merged PR #16 and active PR #19.
- ⚠️ GitHub Actions execution is externally blocked at private-repository job provisioning; the minimal probe fails before runner creation while GitHub public Actions status is operational. Full automated verification must be rerun after organization/account recovery.
- ⚠️ Exact production hostname and Cloudflare Access policy still require dashboard verification.

### 2026-10-03 — Program initialization

- ✅ Completed full architecture/repository audit against `main`.
- ✅ Confirmed current source head `ae7d0b47b89236a9b152a3083c422779946a41b1`.
- ✅ Confirmed repository admin/push access.
- ✅ Created branch `hardening/scalability-overhaul-20261003`.
- ✅ Established this progress file as the modernization source of truth.
- ✅ Baseline CI failure diagnosed; proceed with runtime scalability work while keeping the external Actions outage visible.

## Decision log

### D-001 — Keep the current platform unless measurement proves otherwise
The application remains a static/vanilla web PWA during the scalability refactor. The current bottlenecks are data loading, rendering, caching, and storage architecture; changing UI framework would add migration risk without fixing those root causes.

### D-002 — Preserve medical content authority
Refactors may reorganize delivery and storage but must not silently add, remove, reinterpret, or rewrite medical study content. Existing content/count/image integrity checks remain release gates.

### D-003 — Prefer backward-compatible migrations
User progress and stable content IDs are treated as persistent data. Breaking schema/ID changes require explicit migration and rollback paths.


### D-004 — Treat synthetic GitHub Actions BuildFailed as a control-plane blocker
The failure was isolated with a workflow containing only a standard hosted runner plus shell-native `echo`/`uname`; the result remained `BuildFailed/startup_failure` with zero jobs. Therefore application code, workflow actions, containers, and validators are excluded as root causes. Organization/repository Actions policy, hosted-runner enablement, workflow-execution policy, account billing/usage, or a GitHub-controlled Actions disablement remain the actionable control-plane checks. No production promotion is considered verified until GitHub creates real jobs and the complete quality matrix passes.

Operational outcome: the blocker was resolved by transferring the same repository to the personal `Hafezalhoot` account, after which hosted runners executed normally. The exact organization-side policy/provisioning setting was not identified, so the historical diagnosis remains a control-plane finding rather than a specific billing/policy attribution.

### D-005 — Do not couple Cloudflare production promotion to an unverified push
Workers Builds can deploy directly from the production branch. Until the quality gate is functioning and Cloudflare branch control is verified, the approved operational pattern is version upload/preview first, then explicit promotion after validation.


### D-006 — Keep lecture IDs globally unique while scoping reusable lower-level identities
Subjects and item progress are scoped by course, but lecture IDs remain globally unique in v1. This keeps catalog lookup and lazy loading simple while still preventing the practical course/subject/item collisions identified in the audit. Revisit only if the product genuinely needs the same lecture ID in multiple course packs.

### D-007 — Do not rewrite verified medical content into speculative typed blocks
The current case/core/image/detailed/rapid structures are explicit enough for the product today. A new rich-content block system would create migration and medical-content review risk without solving a current bottleneck, so schema v1 is versioned and validated instead.

### D-008 — Search indexes are sharded by course and subject
A single full-bank search payload would recreate corpus-size coupling, while subject-only filenames would collide when the same specialty appears in multiple courses. Build output therefore publishes one compact `course--subject` shard plus a tiny catalog; only the active scope is fetched, and explicit offline subject download includes that shard.
