# Medical MEQ Workspace V3 — Reader-first design and original-only imagery

**Status:** Draft UX and source-image trial in [PR #28](https://github.com/Hafezalhoot/medical-meq-bank/pull/28), not deployed. Baseline production source is `main` at `d7f3c0b`, candidate preview version `2026.10.17.2`. 
**User direction:** A stronger, potentially complete redesign of the UI and ordering without losing any old features. ONLY photographs from the original uploaded lecture PDFs may be used. Do not create or source replacement medical visuals.

## Current verified architecture and constraints

- Plain static HTML/CSS/JS PWA; Cloudflare Worker hosts generated `dist/` assets.
- Source catalog: course → specialty → lecture → subtopic. In-app progress keyed by stable IDs and stored in IndexedDB with backward-compatible migration. Required tests: `validate`, `chromium-quality`, `webkit-quality`.
- Source-first 4-choice MCQ, Arabic/English Explanation, image spots, cases, short/detailed practice and Rapid Recall; search, offline, print, backup, theme and focus mode.
- Earlier V2 visual critiques found oversized chrome, competing dual sidebars and redundant counters. Remaining app.css has many old layered rules, so a staged consolidation and tested component extraction are preferable to an unverified framework rewrite.
- Renderer cannot display an original copyrighted medical photo publicly when redistribution rights are unconfirmed. Private local original-photo import is a transparent interim solution with honest missing state.

## Direction: Read and Operate

**Read:** prioritize readable real lecture text and authentic original photos over UI chrome. Limit prose measure to about 70–80 characters, 1.9–2.1 Arabic leading, clearly labeled source-page links and understanding aids.

**Operate:** students should find course, lecture, weak/review queue and next question without navigating multiple heavy top sections. Keep advanced filters behind an existing mobile sheet, offer a predictable breadcrumb, preserve compact desktop navigation and visible focus.

Visual tokens: soft off-white page, ink-teal text `#17343e`, clinical teal `#0d6267`, calm light surfaces with simple borders. Dark mode uses a compatible dark teal + mint system. No decorative stock/AI medical imagery, overwhelming gradients, giant metric cards or pointless motion.

### Scope already implemented on the draft branch

1. Paired Course Library + My Review row for quick re-entry while retaining both underlying components.
2. Reworked reader-focused hero, navigation, case/short/MCQ content, and responsive CSS at 700/980px breakpoints, with dark mode.
3. Source-only Dermatology image slots + private IndexedDB import of exact original PDF crops; no generated SVGs used in this lecture.
4. No change to clinical answers, IDs or database schema of existing progress.
5. Draft branch and PR are isolated from production until the regression suite proves there are no lost features.

## Invariant feature inventory — must remain intact

| Item | Existing capability | Acceptance criterion |
| --- | --- | --- |
| Course registry | Surgery, Internal Medicine, Internal Medicine II | All accessible; empty departments honest |
| Question types | MEQ cases / core / detailed / image spots / rapid recall | Same items/IDs/counts and grading states |
| Study guide | Source-linked Arabic Explanation and 4-option MCQ | Source page, choice, rationale and answer retained |
| Search | Scoped search including unloaded lecture index shards | No partial empty results after course switch |
| Progress | Mastered, Review, Weak; My Review + Backup/Restore | Data preserved on every switch/reload |
| Offline | PWA app shell, selective cached lecture | Existing saved lesson and source images work without network |
| Print | Print Center, legacy standalone HTML | No unrelated giant export or missing modes |
| Modes | Light/dark, focus, breadcrumbs, course library | Keyboard and mobile reachability maintained |
| Medical images | Source originals ONLY for Dermatology | Never show a generated source diagram or unsourced clinical image |

## Next phases and release gates

- [ ] **P0 automated regression:** modernized source-only app passes static, Chromium, WebKit, no missing asset/reference, source metadata and old progress import.
- [ ] **P0 source image quality:** each of 14 source figures is correctly mapped to its printed label, image content, source page, and no handwritten markup has leaked.
- [ ] **P1 real-viewport QA:** Playwright screenshots 320, 390, 768, 1280 and 1440px; visual inspect full lecture reading + image spots + imported source images, light and dark, 200% zoom, RTL text.
- [ ] **P1 information architecture:** reduce duplicate navigation, clarify cross-course Review/Resume, replace overloaded header if necessary while preserving all controls.
- [ ] **P1 consolidate CSS:** remove superseded overrides after the final component layout stabilizes and test the 2 sidebar/focus states.
- [ ] **P1 source figure authoring:** automated page provenance, stable crop names, rights approval if public hosting requested, explicit missing-photo recovery.
- [ ] **P1 offline image backup:** clarify that private original photos persist only in current browser and cannot be expected to appear in progress-only JSON backups.
- [ ] **P2 polish:** error feedback, lesson onboarding, first-use explanatory text, print source reference and media alternatives.
- [ ] **P0 release:** owner image-publishing decision, green protected main PR, source/editorial signoff, separate Cloudflare Worker promotion + live smoke test; never silently publish redesign.

## Evidence limits

The PR is **implementation under review**, not a claimed visually complete result. GitHub CI checks are necessary but insufficient; mobile/desktop snapshots and clinical crop accuracy require manual approval. No source images are published to public GitHub at this stage.


## Latest implementation and evidence (2026-10-17)

The current draft V3 browser prototype is now a **source-verifying original-photo reader**, not just a restyled bank:

1. Derm source-only JPEG pack: **14 images, all matched by SHA-256** to the private pack's PDF-page manifest; no source-book photographs committed to public GitHub.
2. Image import: named photos or a ZIP bundle, local secure fingerprint check, fixed per-entry bounds, IndexedDB persistence and controlled refusal of mismatched images. The student can access the same photo in **the visual atlas and source-referenced Image/Spot answer card**.
3. Medical content kept in place: **11 Explanation sections, 30 MCQ, 16 Cases, 70 Core, 17 Detailed, 14 Image/Spot, 41 Rapid**; no new external clinical facts.
4. Test: [full green latest code run #39042336478](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39042336478) for validate/Chromium/iPhone-Safari. Node test of actual extracted ZIP function against all 14 original photos: 14/14 fingerprints match.
5. Owner preview: separate self-contained **personal offline HTML** bundling the original photos, excluded from the public repository; generated from the proven V3 build. It does not mean the Worker has been promoted.

**Pending before completion:** 320/390/768/1440px final human review of the *verified photo-filled atlas* on actual target browsers, rights approval if hosting medical photos publicly, generic course-agnostic source-media authoring (the current importer is an explicit pilot for the Dermatology course), and further CSS consolidation and visual simplification if the learner requests a stronger direction. Do not merge while Draft.



### 2026-10-20 — Course-agnostic source-figure pipeline

The verified photo workflow was generalized beyond the first Dermatology pilot:

- Source fingerprints now live in `imageQuestions[].imageSha256`, already supported by the source lecture schema, rather than in a hardcoded runtime dictionary.
- Study-guide original-photo atlas and spot cards are generated from lecture metadata; current course/lecture IDs drive device-private storage keys.
- The importer identifies accepted JPEG files from each reviewed lecture's own image-question IDs, validates the exact SHA-256, and refuses unsupported/incorrect photographs. Printed PDF pages remain explicit metadata.
- Static validators now distinguish **source-only private JPEG fingerprints** from existing legacy **embedded AVIF** integrity contracts, without weakening the latter.
- Added `tools/prepare_original_figure_pack.py`, a private-only crop/ZIP packager using actual full-page JPEG image layers in a supplied PDF, optional dependencies and a human-reviewed crop map. No remote or AI-generated figures are introduced.
- **Release criteria:** schema/static + Chromium/WebKit pass on new head; real source-crop mapping remains human-reviewed; Cloudflare promotion remains a separate step. The repository never hosts copyrighted clinical photos without permission.

