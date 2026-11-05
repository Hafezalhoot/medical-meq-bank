# Source MCQ Lecture Intake Integrity (V5.6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans and test-driven-development. Implement tasks in order. Red first, verify green and full regression before declaring ready.

**Goal:** Admit medically reviewed source-MCQ-only lectures into My Medical Library and generate accurate `mcqCount` metadata at registration, validating catalog/payload parity on all builds without editing any existing source lecture.

**Architecture:** Reuse the existing Python `tools/add_lecture.py` registrar and `tools/lecture_builder.py` canonical loader. Store `mcqCount` as optional metadata in the existing catalog schema (already supported by V5.5). Keep the five protected `expectedCounts` keys unchanged; do not add a new model or dependency. Allow an MCQ-only lecture only when `validate_lecture` has accepted four answer choices, a valid zero-based answer index, unique stable IDs, a source page and rationale.

**Tech Stack:** Python 3 standard library, existing unittest fixtures and GitHub Actions. No direct Cloudflare changes.

**Spec:** Personal library roadmap #74 and Source MCQ bank #77; this is a follow-on to V5.5 PR #78.

## Global constraints
- Lecture-First Policy: no generated or externally updated medical facts; source PDF controls all MCQ text, options, answer keys, rationale and source pages.
- Registrations with `--write` still require `--reviewed`; dry runs must not mutate files.
- Existing lectures with omitted `mcqCount` remain valid (legacy backwards compatibility), but newly registered lectures always declare an explicit nonnegative count, including zero.
- Historical Surgery baseline, saved device progress, answer keys and existing catalog entries must not be modified or migrated.
- PR targets `main` temporarily for Actions; implementation is stacked on #78, #76 and #75. Do not merge or publish until parent sequence, Cloudflare Access #35 and safe promotion #50 are resolved.

## Review focus and tests
1. A source lecture containing one reviewed MCQ and no legacy question arrays is eligible for dry-run registration and `--write --reviewed` only; unreviewed remains blocked.
2. An imported lecture with both legacy questions and MCQs declares the exact MCQ count; original answer-index/source-page fields remain byte-for-byte unchanged in source.
3. A normal lecture with no `studyGuide.mcqs` declares `mcqCount: 0` without falsely inventing MCQs.
4. A catalog count lower/higher than the reviewed MCQ payload fails canonical loader and prevents publication; booleans/nonintegers/negative counts fail.
5. Existing legacy catalog entries without `mcqCount` still load, preserving saved question identity and historical counts.

## Task 1 — RED regression tests
- Modify `tests/test_lecture_intake.py`.
- Test MCQ-only registration with sourcePage + answerIndex and no legacy question arrays; assert dry-run read-only and successful reviewed write.
- Test `mcqCount` 0/1 on regular and mixed lectures; test mismatched/malformed catalog entries fail loader.
- Trigger existing static quality gate to observe the expected failures in the currently unimplemented registration path.

## Task 2 — Small implementation
- Modify `tools/add_lecture.py`: count source MCQs; permit an otherwise-empty lecture only if valid source MCQs are present; always declare `mcqCount` in generated metadata. No forced edits to older entries.
- Modify `tools/lecture_builder.py`: reject catalog `mcqCount` parity drift or invalid metadata when count is supplied. Existing source `validate_lecture` stays the only medical-shape validator.
- Avoid changes to existing lecture payloads, exam keys, or local-storage code.

## Task 3 — Verify and checkpoint
- Run full source/build `bash build.sh`, Python intake tests, Chromium, WebKit on exact final PR head using GitHub Actions.
- Check PR diff contains only tooling/tests/docs; check source-lecture files, answer keys and old IDs unchanged.
- Record exact tested SHA, run ID and release blockers in roadmap #74 and PR description.
- Leave PR unmerged and Cloudflare untouched pending independent authenticated smoke and promotion gate.
