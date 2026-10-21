# Medical MEQ Bank — Production UI / PWA Incident Audit
**Date:** 2026-10-21 · **Incident:** live version 2026.10.21.1 showed unstyled/mismatched study UI · **Severity:** P0 for study usability
**Evidence:** user-provided desktop screenshot of the actual `medical-meq-bank.hafztamr.workers.dev` homepage; GitHub source inspected at main `13053855759e10846544e86631db8ca4f38780c8`; local Chromium renders of the release's self-contained offline HTML at 320/390/768/1280/1440; GitHub CI and new service-worker-enabled Playwright regressions. **The local test runner cannot access the live Workers domain**, so successful regression CI must be followed by the user's actual deployed screenshot.

## Release safety and scope

- Keep Surgery, Internal Medicine and Internal Medicine II curricula, the 14 **original** hosted Dermatology source photos, 30 Dermatology MCQs, Explanation, Image Spots, Cases, Core/Detailed/Rapid, search, focused reading, My Review, dark mode, print, progress storage, backup/restore and selective offline.
- Keep all medical facts, lecture/image IDs, answers and source printed-page provenance unchanged. No generated/borrowed medical photographs.
- Incident hotfix isolated in [PR #30](https://github.com/Hafezalhoot/medical-meq-bank/pull/30) and tied to release `2026.10.21.2`. No redesign of examination material.

## Confirmed production defects and fixes

| ID | Priority | Surface / evidence | Root cause and impact | Resolution and verification |
| --- | --- | --- | --- | --- |
| UI-01 | **P0** | Live user screenshot: giant black SVG icons, blue old styling, visible skip link, overlap and large empty gaps | New HTML loaded network-first while old service worker `handleAsset()` uses global cache-first `caches.match`, permitting outdated CSS/JS to style new markup | All production CSS/JS now carry `?v=2026.10.21.2`; SW precaches same exact cohort, only reads current release cache; explicit old-cache poisoning regression |
| UI-02 | **P1** | Source: old SW activation deletes every cache other than its new app cache | Opted-in offline lesson JSON/media could disappear across upgrades, without touching stored question-progress DB | Migrate old cached lecture JSON/search/photo assets to stable `medical-meq-bank-user-lessons-v1` before deleting obsolete shell cache; keep downloaded course media separate from app code; migration regression |
| UI-03 | **P1** | Live screenshot: icon size hundreds of pixels; no CSS boundary | SVG default dimensions unsafe while stylesheet unavailable | Add `width=18 height=18` fallback to 13 inline control SVGs to limit damage even when CSS is delayed |
| UI-04 | **P1** | Local full-content browser screenshot at 320, 390, 768: lesson starts below visible fold | Hero and discovery cards consume most of first screen | Compact discovery shortcuts and tablet dual-column layout without removing underlying controls; new viewport thresholds |
| QA-01 | **P1** | Existing Chromium screenshot tests set `serviceWorkers: 'block'` | CI previously never tested mixed-version PWA controlled pages, so all checks green while real users saw broken UI | Add dedicated **SW-enabled** release integrity tests: poison old CSS; assert V3 background and icon width; migrate old offline photos; exercise responsive layouts |
| QA-02 | **P2** | Source validators expected unversioned HTML literal strings | Previous static build validators could reject the intentional asset-version fix or be weakened by removing checks | Update validators for mobile filters, runtime, course packs, progress resilience, generated HTML and correct release-synchronized paths |

## Further observations requiring separate work (do not mislabel as resolved)

| ID | Priority | Evidence | Follow-up |
| --- | --- | --- | --- |
| UX-05 | P1 | `src/app.css` is ~81 KB and contains the older blue palette and later V3 teal overrides; cascade complexity caused unnecessary maintenance risk | Consolidate legacy CSS into one tested token hierarchy and component styles; baseline mobile/light/dark screenshots BEFORE removing overrides |
| UX-06 | P1 | User's screenshot shows homepage only; source-based testing checked study flows in a standalone local render but not live after this hotfix | Validate live Course Library, Subject/Lecture, Explanation, MCQs, Image Spots, print/export, Focus Mode, dark mode and offline after Cloudflare promotion |
| UX-07 | P2 | English-first toolbar/hero, mixed English medical/Arabic explanation | Review bilingual text size, long names and RTL content at 320/390, zoom 200%, keyboard focus and touch; do not alter exam terms |
| UX-08 | P2 | Legacy static screenshot test captures artifacts but does not compare against approved baselines | Add explicit screenshot regression baseline with careful human acceptance to catch large visual shifts while tolerating antialias/font differences |
| UX-09 | P2 | Source includes many PWA/filter/discovery controls in the first screen | Continue progressive disclosure and task-focused density improvements after P0 stabilization; retain every existing route |
| SRC-01 | P1 (governance) | Original Dermatology textbook JPEGs are hosted in the public repo at user's request | Confirm redistribution rights of photographs; screenshots and QA must never replace them with fabricated/generated clinical art |

## Measured local UI quality (not live)

Fresh complete styles and source app rendered in Chromium showed 18px SVG controls, ink/teal hero and working 14-photo Dermatology source atlas. The compact responsive refinement reduced first lecture top from about **862→782 px at 320px**, **844→723 at 390px**, **936→666 at 768px**; 1280/1440 stayed approximately 680/617px. Full-width horizontal overflow 0 in the sampled displays. Offline standalone flow exercised course changes, 14 real original JPEGs, MCQ choices, Focus Mode and dark mode with zero page exceptions in that test. These are **browser-emulated / local HTML observations** and do not substitute for live PWA QA.

## Release acceptance and rollback

1. Green *exact-head* `validate`, `chromium-quality`, `webkit-quality` on PR #30; build validation must continue to reject version-mismatch.
2. Green existing source/payload integrity checks and new controlled SW stale CSS + offline preservation tests.
3. Merge via protected `main`; Cloudflare's configured `npx wrangler deploy` triggers automatic rollout. GitHub merge by itself is **not** confirmation of live Cloudflare publication.
4. Open live `/version.json`; expected `2026.10.21.2`. Hard reload and check ink/teal hero, normal-sized icons, visible selector, actual lesson content and 14 Dermatology figures. Check at least one 390px phone.
5. Keep prior Worker deployment for rollback. If still broken after verified version, inspect DevTools Network responses for `app.css?v=...`, JS error console, and controlling SW version; **do not clear all user data** or wipe IndexedDB/progress as a first-line fix.
6. Backlog the cascade consolidation and more comprehensive live cross-platform reading audit after production stabilizes.

**Status:** Fix implemented and browser CI passed on initial code head. Record final post-documentation checks and actual public rollout separately; do not claim full-site final quality until verified.
