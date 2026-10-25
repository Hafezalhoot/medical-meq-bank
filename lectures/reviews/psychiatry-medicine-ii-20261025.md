# Psychiatry — source-first editorial gate (2026-10-25)

Status: **NEEDS MEDICAL REVIEW — DRAFT ONLY.** Do not merge or activate until checks and clinical review pass.

## Provenance
- Psychiatric History Taking & Mental Status Examination: user-supplied `1- psychiatric_history_taking.pdf`, **44 PDF pages**, SHA-256 `4eda3423372bdd57c76b40e65a1dd7c990226e7db369124a94ec9eb77dcbd2cb`.
- Anxiety Disorders: user-supplied `2- Anxiety disorders.pdf`, **43 PDF pages**, SHA-256 `a0588e9348f9768d7a38faf7c791e281aa2b9b14a917fdf126f501b6d56f5f08`.
- All source page numbers count from PDF page 1. The original PDFs and embedded clinical/illustrative figures are deliberately NOT copied to the public repository.

## Coverage map

| Lecture | Original PDF pages | Indexed authored content |
| --- | --- | --- |
| Psychiatric History and MSE | 2–21 | interview, onset/HPI, background, family/personal, premorbid personality |
| Psychiatric History and MSE | 22–38 | MSE, appearance, speech, mood/affect, thought content/form, perception, cognition |
| Psychiatric History and MSE | 27–30, 34–35, 39–43 | image-only thought and interview examples: cite original figures, do not invent figures; review detail manually |
| Anxiety Disorders | 2–12 | definitions, symptoms, Case 1, panic criteria incl. image-only DSM-5 table p.12 |
| Anxiety Disorders | 13–21 | Case 2 GAD, Case 3 agoraphobia, source-image diagnostic tables pp.16,21 |
| Anxiety Disorders | 22–30 | Cases 4–5, specific and social phobia, p.24 image-only criteria |
| Anxiety Disorders | 31–41 | differential, figures and prevalence, prognosis, medications, psychotherapy |
| Both | final slides | references/thank-you treated as non-exam content |

## Deliverable inventory (all still draft)
- Psychiatric History: 33 Explanation sections, 42 proposed source-linked MCQs, 5 cases, 36 core shorts, 10 detailed shorts, 3 original-PDF reference-only image spots, 20 rapid recall pairs.
- Anxiety Disorders: 32 Explanation sections, 47 proposed source-linked MCQs, 5 cases (the same five teaching cases in the PDF), 40 core shorts, 10 detailed shorts, 4 original-PDF reference-only image spots, 24 rapid recall pairs.

## Explicit caveats
- Case 2 of Anxiety Disorders does **not** state an independently confirmed six-month duration; Case 5 also does not state a specific six-month duration. The slide's teaching diagnosis is retained but the omitted criterion is not invented.
- In Psychiatric History, several important teaching tables are raster-only (especially pp.27–30 and 39–43). Added explanations and test questions for p.27–28 terminology, p.30 flight/clanging and p.39–43 clinical interview/cognitive examples; source illustrations remain PDF-only and must still be checked against the original. Check the original pages before approval.
- The multiple-choice alternatives are authored pedagogical distractors, not original verbatim PDF options. Every answer and rationale must be checked against its cited page; no automatically scored content is approved by a successful build.
- No photos or full-page images are published. Source-page image questions require access to the original user-supplied PDF.

## Additional independent source reading (2026-10-25)

- User-supplied PDF SHA-256 values checked against the two actual uploaded files; page counts confirmed (44 / 43).
- Inspected raster-only pages: History pp.27–28, 40–43 and Anxiety p.34. Expanded clinical-table definitions and interview examples using source wording; **no new classifications or outside treatment guidelines**.
- Exam-mode answer-position skew in original draft (zero D-key MCQs) corrected by deterministic reordering of existing choices while preserving the correct answer and explanation. 42 + 47 questions now distribute answer indices evenly.
- A new regression test validates two psychiatry lecture IDs, course catalog, every source page reference, option uniqueness and balanced answer positions; source PDFs/images remain excluded from public source control.
- Technical build tests cannot substitute for individual educational answer-key review.

## Required acceptance
- [x] Structural verification: 89 MCQs have distinct option texts, valid source-page links and balanced A/B/C/D correct-answer positions; this check does NOT establish clinical correctness.
- [ ] Each MCQ answer, wording and distractor verified against source PDF.
- [ ] Lecture criteria/durations/percentages and therapy wording checked without substituting outside guidelines.
- [ ] Every source-page citation and hard-to-read figure confirmed.
- [ ] No unsafe clinical information or private patient details published.
- [ ] Full latest-SHA static tests, Chromium, WebKit, Cloudflare Workers Build pass.
- [ ] Protected live QA / production gating issues #35 and #50 not bypassed.
- [ ] Explicit human editorial approval before merging or deploying.
