# My Medical Library — Study-First Recovery Design

Date: 2026-11-18
Status: proposed design and implementation contract, not a deployed release.
Baseline: protected main ca6e39a3c87c5822a83d72f648b4be9d033351ae; source version 2026.11.15.2.
Evidence: independent 2026-11-18 audit, DESlGN.md (see DESIGN.md), AGENTS.md, README.md, tests.

## Why

The learner wants to resume studying a real lecture, review source-based explanations and original figures, practice questions one at a time, assess genuine mistakes, and create new lectures from their own PDF. Today the building blocks exist but the Library first screen is crowded on mobile, the Reader MCQ tab stacks all questions, source coverage differs between lectures, and a selected PDF only creates draft metadata.

## Considered approaches

1. Full React/Next rewrite: flexible new structure but unacceptably risks mature offline/PWA, backup, question-ID and source-figure behavior.
2. CSS-only restyle: lower immediate cost, but it does not fix duplicated learning flows or the unimplemented PDF-to-reviewed-lesson pipeline.
3. **Recommended: incremental study-first repair on current vanilla HTML/CSS/JS**: reuse existing workspaces, stable identifiers, imports and full quality gate. One safe, verifiable PR per slice.

This is the engineering recommendation for the user's requested plan, not a claim of separate formal approval.

## Experience contracts

### Library

- Mobile first action is Continue studying when a valid saved position exists; otherwise the first authentic lecture card is within the initial viewport.
- At 320x700, top of the first lecture card must be <=430px without a resume card; at 390x844 also <=430px.
- Preserve course, specialty, chapter and lecture context without redundant headings and filter chrome.
- Keep search, no-results, Add lecture draft and back/forward navigation keyboard-accessible.
- Display rated progress (personal study) separately from exam accuracy.
- Show exactly which sections exist for the lecture; no fake/external-source Explanation or MCQ.

### Lecture

- Use source-only, bilingual readable Explanation with original figure references and page labels where available.
- Reuse present reader topic navigation, 100/112/125/138% text size, offline and print features.
- MCQ tab defaults to **one visible question**, with previous/next and source-linked feedback. Browse all remains an optional review/print mode.
- Preserve authored MCQ IDs/answerIndex, MEQ/manual self-rating and exam score distinctions; navigation by itself must never mark an item Weak.

### Practice/Exam/Review

- Practice means recall then reveal and explicit personal rating of written answers; reviewed MCQ keys alone allow objective correctness feedback.
- Exam means own scope, timer, interrupted-session restoration, score and mistake history.
- Review means a source-linked queue of genuine Weak/Review and mistakes, without inventing grades for unanswered content.
- Progress is device-local unless a future, separately reviewed sync implementation exists; keep explicit backup and restore-preview safety.

### Manage Library

- Current four-step draft metadata tool remains a **private/unpublished draft**.
- Build a staged original PDF intake: per-page text/table/diagram/figure inventory, source-to-topic mapping, lecture-first explanation/questions, editorial/medical review, dry-run schema/source-media integrity, atomic catalog insertion through a protected pull request.
- Pilot one lecture before mass import. Never copy private PDFs or copyrighted source media to a public repo without rights review.
- Missing science stays marked as unavailable until reviewed source PDFs are supplied; no fabricated lecture facts or generated medical pictures.

## Universal invariants

- Source lecture only for exam facts. Do not rewrite classifications, treatments, doses or correct answer indices to current guidelines.
- No changes to published lecture JSON, media bytes, stable question identities, IndexedDB keys, saved ratings, exam sessions, or backup schema from UI PRs.
- No dependency/framework change without measured benefit.
- Accessible 320/390/768/1024/1440 px, 200% zoom, RTL/LTR, light/dark, reduced motion, keyboard, touch and print. Target >=4.5:1 for normal text and >=44px for essential touch actions.
- Source, standalone offline and PWA version cohort remain aligned; every release needs static+Chromium+WebKit exact-head verification.
- Production remains distinct from GitHub merge. Cloudflare Access #35, build-only/manual promotion #50, Worker version traffic, authenticated smoke and rollback must be independently demonstrated.

## Definition of done

The core journey works from first screen to saved review without excessive scrolling; each lecture truthfully advertises what is available; a real source PDF pilot can be safely reviewed and published; all required regressions are green and the active Cloudflare version has authenticated proof. Full medical correctness needs manual matching to each original PDF, not merely schema/hash validation.
