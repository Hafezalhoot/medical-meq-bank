# MEQ Bank — Comprehensive Product & Lecture-Intake Audit

**Date:** 2026-10-16. **Source:** public GitHub repository Hafezalhoot/medical-meq-bank.
**Baseline:** main commit 80e5a7a; interface work PR #23; separate lecture intake PR #24.
**Method:** installed Impeccable methodology (Operate + Read), UI/UX Pro Max, real user screenshots, V2 Playwright visual evidence, source-tree inspection and GitHub CI. No original standalone Impeccable 59-rule binary scan, physical-device QA or independent clinical fact review was performed.

## Evidence inventory

- Two registered courses: Surgery and Internal Medicine; 11 registered specialties (4 + 7).
- Nine currently published lecture catalog entries; Surgery material dominates. Most Internal Medicine topics have no reviewed lecture payloads yet.
- Five published learning/practice modes: MEQ cases, high-yield shorts, image/spot questions, detailed practice and Rapid Recall.
- Progress statuses, ID migration, backup/restore, indexed storage, full-text searching, selective offline/PWA, print/PDF and responsive/dark user interfaces already exist.
- A BPH lecture source is approximately 1.47 MB, so metadata-first loading and image size limits must remain release gates.
- PR #23 (V2) already implements a Course Library, compact header, Focus Mode, progressive statistics, image navigation, Start/Continue study and mobile tools. The latest checked CI run passed all three jobs.

## Severity-ranked issues

| ID | Priority | Observed evidence | Consequence | Resolution/state |
| --- | --- | --- | --- | --- |
| A01 | P1 | Original production screenshots: tall hero, repeated metrics and utility controls above actual cases | A student must navigate too much before answering a clinical question | V2 compact hierarchy, resume and collapsed insights implemented; visual user acceptance pending |
| A02 | P1 | Original screenshots: two competing sidebar columns compress scenario reading area | Long Arabic and English case material harder to read | Narrowed sidebars + reversible Focus Mode in PR #23 |
| A03 | P1 | Lecture v1 schema defines MEQ, core, image, detailed and rapid fields but no structured Explanation, MCQ or Infographic content | Uploaded PDFs cannot yet produce the complete 3-view study experience inside this site | Add a backward-compatible optional companion contract + renderer; not yet live |
| A04 | P1 | Previous add_lecture.py wrote catalog/files sequentially and updated the frozen Surgery baseline | Failed writes could leave half-registered lecture and weaken historical regression checks | Staged rollback-safe writes, source review flag and immutable baseline implemented in PR #24; CI required |
| A05 | P1 | Public source repository and live Worker | Patient/private details or copyrighted lecture images could be publicly redistributed | Source/permission/privacy checkpoint before any commit |
| A06 | P2 | Large embedded image/data payloads and legacy materialization fragments | Large authoring/build cost, possible growth of the offline export | Prefer validated local assets for new images; retain lazy loading, integrity and bundle limits |
| A07 | P2 | 54KB of app.css with several historical breakpoint/override layers | Visual refinements may regress other viewport widths | Consolidate repeated selectors/tokens only after V2 visual acceptance |
| A08 | P2 | courses/README.md mentions legacy directory paths while current packs live under courses/packs | Contributors could register new courses in the wrong location | Update and unify source-first authoring documentation |
| A09 | P2 | Real bilingual medical questions, narrow controls and potentially very long lecture titles | 320px / 200% zoom / RTL may clip or misdirect content | Extend browser visual and keyboard tests; label untested physical-device behavior |
| A10 | P2 | Course list includes future empty subjects and no global My Review/Study Home across courses | Poor orientation for a full multi-year medical curriculum | V2 course library/empty states first; cross-course continue/review queue next |
| A11 | P2 | Lecture IDs, content lists, catalog counts, image paths and course subjects span multiple files | New PDF insertion is error-prone without one reviewed handoff | PR #24 now stages a draft with source PDF identity, validates media, guards stable IDs and rolls back on I/O errors |
| A12 | P3 | Existing styling + extensions use several separate modules | Progressive polish can accumulate too many one-off selectors | Gradual design-system extraction after functionality stabilizes |

**Verdict:** This is a solid offline-first medical study engine, not a template requiring replacement. Main debt is learnability, visual hierarchy, corpus expansion and a safe, repeatable authoring pipeline. No artificial numerical design score is assigned: current evidence does not justify one.

## Preserve these proven capabilities

| Contract | Must remain intact |
| --- | --- |
| Academic identity | Course → Specialty → Lecture → Subtopic; published IDs never silently renamed |
| Exam content | MEQ questions/answers/marking/traps, Core Shorts, Images, Detailed, Rapid |
| Learning state | Mastered/Review/Weak, IndexedDB, migration, backups |
| Retrieval | Search, lecture/subtopic/type/status filters, random, reveal, resume |
| Distribution | PWA/offline selective lecture downloads, standalone HTML, print/PDF |
| Accessibility | Keyboard, visible focus, dark/light, reduced motion, mobile touch, screen-reader semantics |

## Target content & publication flow

~~~text
Upload source PDF to ChatGPT
  → source-page review + Arabic explanation with English medical terms
  → lecture-first MEQ/short/image/detailed/rapid content
  → optional (future) Explanation + MCQ + Infographic approved companion
  → human content review and mapping against source pages
  → canonical JSON + approved images
  → dry-run + explicit reviewed registration
  → GitHub pull request + static/Chromium/WebKit quality gates
  → protected merge → manually approved Cloudflare promotion
~~~

The current five-mode core lecture schema remains compatible. Optional companion fields must be non-executable, page-traceable, accessible, properly escaped, and absent when no reviewed data exists. They must not reset prior progress records. For a public site, do not add an unauthenticated raw PDF upload button; controlled ChatGPT-assisted preparation plus GitHub PR avoids publishing untrusted sources directly.

## Roadmap and release criteria

| Phase | Deliverable | Definition of done | Current status |
| --- | --- | --- | --- |
| R0 | Full source-backed audit | Findings, preserved-feature inventory, risks and staged plan | ✅ This report |
| R1 | Reviewed lecture intake | Draft generator, dry run, strict assets, rollback and unit tests | 🟦 In PR #24; full checks pending |
| R2 | Explanation/MCQ/Infographic companion contract | Validated schema, page attribution, anti-injection, optional content | Planned |
| R3 | Medical study companion UI | Render sourced explanation, MCQs and infographic only when data available; responsive, printable and offline where supported | Planned |
| R4 | Cross-course Study Home + My Review | Continue by subject; actionable Weak/Review without invented stats | Planned |
| R5 | Visual and accessibility polish | 320/390/768/1440, RTL, long text, 200% zoom, dark mode, keyboard/axe | Ongoing PR #23 |
| R6 | Final regression & release | No missing capability, green full matrix, user visual review, approved deployment/rollback | Planned |

**Release discipline:** PR #24 intake-only can be reviewed separately from PR #23 UI. Do not change exam answers during UI work, do not automatically merge unreviewed lecture science, do not promote a Cloudflare version merely because a build is Ready. Update PROJECT_PROGRESS.md after each milestone.

## What the learner does next

For the first newly added lecture, upload the complete PDF in ChatGPT and name its course and specialty. The scientific content will be prepared and verified in stages before the registrar publishes it. Explanation/MCQ/Infographic as separate native site modes are **not yet complete**; they remain a required additive implementation milestone.
