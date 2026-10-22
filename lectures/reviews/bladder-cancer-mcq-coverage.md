# Bladder Cancer — source-linked MCQ candidate review

**Status: PENDING learner / lecturer content approval. Do not merge this clinical-content PR based solely on automated tests.**

**Reference:** user-uploaded `Bladder cancer 4(1).pdf`, 24 slides, by Dr Amr Hassan Alkhalily. Source text was read across all pages; staging (slide 9), NMIBC management (slide 19) and MIBC management (slide 20) were also visually checked. The PDF, any original images and their copyrighted page backgrounds are **not** committed or republished.

## Lecture-first scope

This candidate adds **31 four-choice MCQs** to the *existing* `urology-bladder-cancer` lecture through a separate checked JSON companion. Each new question has its own stable ID (`bc-mcq-001`–`bc-mcq-031`), one answer index, a short rationale and an explicit PDF page. The 12 cases, 30 core shorts, 8 image spots, 59 detailed shorts and 34 rapid cards generated from the verified compressed transport are **not modified**. The companion is applied **only after** the original transport SHA-256 matches the existing manifest.

No new medical guidelines, treatments, dosage statements, external classifications, fabricated images or autonomous grading of descriptive questions are introduced. Distractors are question options for recall, **not extra lecture assertions**.

## Page-to-question inventory

| Original PDF page | Printed lecture topic | Draft MCQs |
| --- | --- | --- |
| 4 | Histological types and TCC frequency | 001–002 |
| 5 | Non-muscle-invasive share | 003 |
| 6 | Layers of the bladder wall | 004–006 |
| 7 | Risk factors and schistosomiasis association | 007–008 |
| 9 | Ta, Tis, T1, T2, T3, T4 staging | 009–014 |
| 11 | Painless haematuria, early examination, ureteric obstruction | 015–017 |
| 13 | Urine-based investigations | 018 |
| 14 | Ultrasound vascular soft-tissue mass | 019 |
| 15 | CT as primary imaging modality | 020 |
| 16 | MRI wall-layer differentiation and radiation | 021 |
| 17 | Cystoscopy with biopsy as primary diagnosis | 022 |
| 19 | TURBT, intravesical therapy, cystectomy indications, recurrence and surveillance | 023–027 |
| 20 | Muscle-invasive cystectomy and neoadjuvant cisplatin | 028–029 |
| 21 | Non-continent versus continent urinary diversion | 030–031 |

This is a **selective, not exhaustive** study-guide set. The original lecture contains additional exam facts and images that were intentionally not converted into MCQs in this batch.

## Medical approval checklist

- [x] All 31 questions have unique stable IDs, exactly four non-empty answer choices and `sourcePage` pointers to the uploaded PDF.
- [x] Key statements and rationales drafted from the uploaded teaching PDF, not external clinical sources.
- [x] Preserved legacy question sets and original slide/image materialization checksums.
- [ ] Learner/instructor verifies every question, distractor, answer index and rationale against the actual PDF and confirms Lecture-First fidelity.
- [ ] Reviewer confirms that any source slide ambiguities or typos should remain as taught, and that no new facts appear accidentally.
- [ ] Exact-head static/build, Chromium, WebKit and Cloudflare Worker Build pass with both source MCQs and existing MEQ item identities intact.
- [ ] Only after medical sign-off: merge to protected main and verify the exact Worker version and authenticated study/quiz experience on Cloudflare Access.

**Not medically approved or published solely by preparing this PR.** The original source PDF remains outside the public repository.
