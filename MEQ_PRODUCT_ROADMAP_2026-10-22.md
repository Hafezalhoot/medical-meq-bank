# Medical MEQ Bank — Product Evaluation and Priority Roadmap
**Audit date:** 2026-10-22
**Observed live release before this PR:** `2026.10.22.2` (Worker `5c3fcfce-4f81-4ba7-828a-61376dc82f3c`, 100% traffic in [production status run #39695650888](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39695650888)).
**Current feature hardening:** PR #46 (`2026.10.22.3` candidate), subject to exact-head validation.

## Evidence and confidence

- **Direct source/distribution audit:** Exam Mode scripts and styles, original question/progress/PWA loaders, the published catalog and generated `dist` from the successful `main` CI run.
- **Verified CI:** [#39695650798](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39695650798) passed static/content/build, Chromium and WebKit quality checks; Cloudflare Workers Builds succeeded. Production traffic percentage verified **independently** via Wrangler in the read-only production-smoke job.
- **Not yet verified in the live browser:** Cloudflare Access redirects unauthenticated GitHub smoke with HTTP 302. Service Auth is still issue [#35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35). A successful source/browser test is not a live post-login visual audit.
- The current package contains **10 published lectures**, **1,432 authored items across five legacy practice categories**, and **30 source-keyed auto-gradable MCQs**, currently all in the Dermatology introduction lecture. Counts are overlapping ways to practice content, not 1,462 independent clinical facts. It also includes 11 Dermatology explanation sections. This inventory describes what is shipped, **not** an independent medical faculty audit.
- Actual test report screenshots cover representative mobile/tablet/desktop layouts and reading. The complete logged-in production journey, rights to publicly redistribute copyrighted original-book photos, and all-content medical-signoff are **not established** by CI.

## Evidence-based assessment

| Dimension | Estimate / 10 | Why |
| --- | ---: | --- |
| Frontend / modular release engineering | 8.5 | Built PWA, offline HTML, versioned assets, protected checks, source-on-demand |
| Study tools and progress integration | 8.5 | MEQ/Shorts/Images/MCQs, Weak/Review/Mastered, print, resume, new Exam Mode |
| UI hierarchy / mobile reading | 7.4 | Strong V3 direction; dense course+filter chrome before first learning task |
| Medical curriculum breadth | 5.5 | Ten live lectures, nine without source-keyed MCQs; multiple registered specialties still empty |
| Lecture authoring workflow | 7.0 | Source-aware registration and checks, but multi-step/manual publication process |
| Runtime and production assurance | 7.0 | Source CI green; authenticated production visual and photo smoke not configured |
| Safety, rights and portability | 6.7 | Source-first controls and private Access; source-image rights and sync/backup product UX remain open |

**Overall planning estimate: ~7.5/10**, not a validated usability-study score. Raising the score will depend more on educational coverage and a smooth daily student journey than on adding decorative design effects.

## Release blockers and top priorities

### P1 — Verify real production behind Cloudflare Access
- Introduce narrowly scoped Zero Trust **Service Auth** in parallel with existing human login, using secrets `MEQ_CF_ACCESS_CLIENT_ID` / `MEQ_CF_ACCESS_CLIENT_SECRET` on GitHub Actions.
- Rerun live version/CSS/JS, authenticated 320/390/768/1440px reader, original-image SHA integrity, offline fallback, resume, quiz, and console/network QA. **Do not remove Access**.
- Acceptance: exact active Worker matches reviewed release, core study/exam journeys pass on live protected URL, and no unexpected image or asset failures. Preserve screenshots/traces on failures.

### P1 — Expand faculty-verified MCQ coverage
- Current automatic grading serves only **30 reviewed Dermatology MCQs**. All remaining nine lectures support self-graded MEQ / Short / Spot questions, but should **not** pretend to have automatic marks.
- For each new lecture, follow Lecture-First source review; ensure every answer, option and rationale can be audited back to a specific slide/page. Do not automatically invent distractors or treat a model short-answer as a true/false MCQ without qualified review.
- Acceptance: validated source-page references, MCQ option plausibility, answer-key proof, negative questions tested, and `Weak` persistence/end-to-end Playwright test per new lecture pack.

### P1 — Close usability gaps in Exam Mode and the daily study path
- Fix session replacement without forcing a student to finish early; make Save & Close visible; surface real persistence warnings even after answer feedback re-render.
- Keep session ratings after confirmed replacement; do not mark unanswered/timed-out items weak automatically.
- Acceptance: 320/390px navigation, modal keyboard/trap/escape, blocked storage warning, repeated attempts, and no unexpected modification of IndexedDB progress. PR #46 addresses the first session-resume UX increment.
- Next: a **Continue latest lecture / Daily review** first action with less introductory chrome and a clear distinction between *Practice (instant feedback)* and *Mock (deferred feedback)*.

### P2 — Personal revision engine (largest study outcome improvement)
- **Daily Weak 15:** one-click adaptive review queue based on Weak/Review history and time since last interaction, with explainable selection criteria and no hidden medical inference.
- **Topic mastery matrix:** percentage mastered, active Weak, last practised date, and repeated-mistake frequency across subject and lecture, displayed separately for auto-scored MCQs vs self-marked clinical questions.
- **Mistake notebook:** revisit explanations and lecture-source pages from an exam result; retry unmastered items without losing their first-attempt record.
- Acceptance: saved across reload, robust exports, no ratings overwritten by view-only actions, no conflation of self-graded and objective accuracy.

### P2 — One-source PDF-to-lecture review pipeline
- Drop the lecture into an intake queue → source extraction and page map → explanation + source-keyed MCQs + image/spot candidates → **faculty/student approval** → preview branch → validators/browser/snapshot checks → live insert.
- Interface should distinguish `Draft`, `Needs review`, `Ready`, `Published`. Keep wrong/unsupported claims quarantined, and never silently convert outside guidelines into exam facts.
- Acceptance: a small controlled dry-run adds a real new lecture without changing existing IDs, reference images, saved ratings, offline manifest or progress backup; maintain an exact authoring trace.

### P2 — Reading and search polish
- Unify Arabic/English BiDi on headings/answers/feedback and images; remove redundant header or toolbar rows; keep mobile first content reachable with minimal scrolling.
- Add *source-page quick jump* from exam question/review; provide context around in-lecture search hits and a clear empty state.
- Acceptance: no overflow at 320px and 200% zoom; keyboard/VoiceOver focus path; accessible color contrast in both themes; no significant performance regressions.

### P3 — Optional sync, collaboration and convenience
- **Preserve the existing Backup Progress / Restore Progress functionality** (manual JSON export/import already ships). Make its date, data coverage, restore confirmation and device-switch guidance clearer; cross-device accounts can be introduced only when demand justifies authentication, privacy and maintenance cost.
- Opt-in personal notes, bookmarks and high-yield topic lists based strictly on the lecture.
- Read-only shareable practice link or class quiz after exams are medically reviewed; never leak private student notes.
- Avoid speculative gamification, AI chatbots guessing clinical answers, or wholesale framework rewrites.

## Suggested delivery order

1. Finish PR #46: exam-session recovery and reliable feedback, and deploy only after quality gates.
2. Fix protected live browser QA (#35), capture UX evidence and rights review.
3. Implement **Daily Weak 15** + **Mistake notebook** with tests and transparent accuracy labels.
4. Pilot one additional fully source-reviewed MCQ-enabled lecture from Urology.
5. Introduce the **Lecture Intake Review** interface and repeat the pilot across 2–3 lectures.
6. Expand to other subjects with consistent templates, measurable quality and no loss of existing tools.
7. Polish existing Backup/Restore guidance; add optional automatic cross-device sync and advanced analytics only after the earlier learning surfaces are stable.

## Non-negotiable safeguards
- Maintain existing MCQ answer keys and original authored medical facts; never manufacture clinical answers or assume outside scientific updates are exam facts.
- No renaming of stable IDs or destructive progress reset; every version must keep IndexedDB compatibility and offline asset integrity.
- Do not disable or bypass Cloudflare Access, commit secrets, or conflate 100% Worker traffic with successful authenticated product QA.
- Do not publicly redistribute original copyrighted book imagery until the project owner has documented permission or an applicable legal basis.
- Every change gets a focused regression, exact-head static+Chromium+WebKit CI, protected merge, confirmed Worker status, and a truthful release note.
