# V6 UX-02 — Execution ledger

- Base: UX-01 `aa24d35da93f9bd90635574e1a8d3153ffa13649`.
- Design authority: PR #83 V6 specification.
- 2026-11-06 — RED tests committed first: `tests/v6-library-index.spec.js`, `tests/test_chapter_metadata.py`. Current source has no optional Chapter schemas or Library search; expected tests to fail.
- Ruling: Chapters remain optional metadata, without assigning medical topics or chapters to existing lectures. Old lecture IDs, progress keys, MCQ answers and original images remain immutable.
- Ruling: Implement course/specialty navigation and search using existing vanilla JS and the current course registry; no React/Tailwind rewrite.
- Next: observe failing tests, implement minimum schema+validator+library UI, run exact-head CI, do not promote to production.
