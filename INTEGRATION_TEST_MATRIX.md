# V2 + Lecture Intake — Integration Preview Release Gate

**Date:** 2026-10-16  
**Branch:** `integration/medical-study-v2-intake-20261016`  
**Base:** protected `main` (this integration PR is intentionally **Draft**).  
**Sources:** clinical-study design PR #23 and reviewed-lecture intake PR #24, both implemented independently.

## Confirmed preservation contract

- Nine published Surgery lectures and their original cases, shorts, image questions, detailed shorts, rapid cards and stable IDs remain unchanged.
- Existing IndexedDB ratings, migration keys, backup/restore, PWA/offline cache, standalone HTML and print/PDF functionality retain their original data structures.
- Course selection, Focus Mode, review status filtering and new My Review use the existing runtime registry and progress store.
- Optional `studyGuide` Explanation, MCQ and Infographic are **additive**; old lectures have no fabricated optional content.
- Raw user-uploaded PDFs and medical claims are never auto-published to a public GitHub repository.

## Required whole-system checks

| Gate | How | Result |
| --- | --- | --- |
| Clean build / Python lecture and course tests | `bash build.sh` / `npm run quality:static` | Await combined integration CI |
| Static structural, image-integrity and bundle validation | canonical static quality gate | Await combined integration CI |
| Study, course switching and preserved progress | Chromium Playwright | Await combined integration CI |
| My Review: cross-subject, 320px, dark, keyboard | Chromium Playwright | Await combined integration CI |
| Optional studyGuide: plain text escaping and three content modes | Chromium Playwright | Await combined integration CI |
| Offline, print and performance budgets | Chromium Playwright and static checks | Await combined integration CI |
| Safari and iPhone WebKit regressions | WebKit Playwright | Await combined integration CI |
| Real PDF content coverage, clinical fact-check and source-page checks | manual human content review | Not run yet |
| Visual inspection of screenshots at 320/390/768/1440, Arabic/RTL and 200% zoom | human UX sign-off | Not complete |
| Production deployment to Cloudflare Workers | after approved green protected merge | Not authorized; unchanged |

## Publishing one new lecture after approval

1. Upload the PDF in ChatGPT and identify Course and Subject. Never fabricate unreadable slide content or update exam classifications from external guidelines.
2. Generate Arabic explanation, MEQ/short/image/rapid practice and optional MCQs/infographic with source-page attribution.
3. Check coverage against the original PDF, correct ambiguous figures and acquire any necessary publication permission.
4. Use `tools/new_lecture.py` for a draft, then `tools/add_lecture.py ... --course <id>` for a non-mutating preflight.
5. After explicit source review, use `--write --reviewed`, inspect changes, run the full CI matrix and deploy only via the protected release path.

**No green CI badge certifies medical factual accuracy.** This document records code integration only.
