# D2 — Honest Lecture Rating Progress Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Library cards should count source MCQ ratings in the same rated fraction as existing written/case/image ratings, without presenting a study rating as MCQ exam accuracy.

**Architecture:** Keep existing storage, ID scope checks, and metadata-first delivery. Adjust only lecture card denominator and the types counted in the existing `lectureProgressPercent()`; no new tracking or source changes.

**Tech Stack:** Vanilla JS, Playwright, source lecture JSON.

**Spec:** `DESIGN.md`, My Medical Library #77, and existing progress distinctions in `AGENTS.md`.

## Global Constraints
- No changes to lecture JSON, correct answers, photo hashes, IndexedDB keys, exam score calculations or backup schema.
- Count each recorded status once using existing identifiers; zero MCQ lectures remain unchanged.
- No attempt at production promotion without GitHub full quality gates and Cloudflare Access authenticated smoke.

## Review Focus
- Six reviewed source MCQs rated in Dermatology should contribute to Library card rated percent.
- Extra unreviewed/false MCQs in other specialty or course must not count.
- Missing MCQs do not fabricate progress or scored exams.
- Source-only lecture contents remain unmodified.
- Existing course/subject selection and offline mode remain unchanged.

### Task 1
- [ ] Add a failing real-browser test for source MCQ rating on a Library card.
- [ ] Observe RED on existing code.
- [ ] Update `lectureProgressPercent()` to include metadata source MCQs and status type `mcq`; retain course/specialty filters.
- [ ] Run full Static/Chromium/WebKit and inspect exact tested commit.
- [ ] Review scoped diff, then merge only with green gates.

## Release boundary
This PR does not activate Cloudflare Workers traffic. Production #35/#50 remain separate.
