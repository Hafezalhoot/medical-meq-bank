# Internal Medicine II / Dermatology — Introduction to Dermatology

**Status:** Editorial-review Draft. Source: the user's 10-page scanned `Dermatology Department book 2022.pdf` (Introduction to Dermatology pp. 1–10). The uploaded scan is **not** committed to this public repository.

## Scope and lecture-first source map

| Supplied PDF page | Printed teaching topics | Study content |
| --- | --- | --- |
| 1 | Definition, skin surface/weight, systemic links (pallor, cyanosis, jaundice, thyroid, HCV) | Explanation §1; short questions, cases 1–3, MCQs |
| 2 | Three layers, epidermal cells, basal/prickle/granular/horny layers | Explanation §§2–3; skin-layer schematic, cases, shorts, MCQs |
| 3 | Dermis/hypodermis, appendages, eccrine/apocrine, alopecia/depigmentation | Explanation §4; skin-layer schematic, case, short/MCQ |
| 4 | Eight skin functions, primary lesions, macule versus patch | Explanation §§5–6; flat-lesion diagrams and MCQs |
| 5 | Papule and plaque, size rule, verruca and psoriasis examples | Explanation §6; solid-lesion diagrams, cases and MCQs |
| 6 | Nodule, vesicle, bulla, cyst wall and listed examples | Explanation §7; fluid/solid diagrams, cases and MCQs |
| 7 | Pustule, wheal, open and closed comedones | Explanation §8; schematic image spots, cases and MCQs |
| 8 | Burrow, secondary-lesion causes, secondary pustule and crust | Explanation §§8–9; lesion sketches, cases and MCQs |
| 9 | Scale, excoriation, fissure and erosion | Explanation §§9–10; image spots, shorts and MCQs |
| 10 | Ulcer, epidermal/dermal atrophy and lichenification | Explanation §11; comparison questions and MCQs |

## Exam-safe content rules

1. Preserve the lecture's **1/7 body weight**, **1.75 m²**, **under versus over 1 cm**, and its exact example lists. Do not silently replace teaching values with outside sources.
2. No scientific updates, clinical treatment guidelines, drugs, tests or classifications outside the uploaded PDF.
3. All Explanation and MCQ items include source-page links. Extra memory aids are visibly labeled **Understanding Aid — Not an additional exam fact**.
4. The MEQ cases are synthetic **morphological classification vignettes** derived only from printed definitions, not real patient descriptions or external medical diagnoses; the practice marking is not an official exam mark scheme.
5. The three vector figures in `assets/lectures/dermatology-intro/` were authored specifically for this lecture. They are **simplified illustrations**, not clinical images, and must not be used as replacements for real examination photographs. Panel A–L morphology questions include explicit size measurements when size is necessary, because visual sketches are not to scale.
6. Do not redistribute the original scanned book, its handwritten notes, the embedded chat screenshot or the clinical photographs without rights clearance. This branch includes no source-book page images.

## Structured learning inventory

- **11** Arabic Explanation sections with English medical vocabulary and source-page labels.
- **30** four-choice MCQs with distinct IDs, answers, rationales and source-page labels.
- **16** lecture-derived MEQ morphology vignettes.
- **70** core short questions; **17** detailed questions; **41** rapid-recall cards.
- **14** image-spot items, backed by two original local SVG schematic diagrams.
- **1** original primary/secondary-lesion infographic SVG.
- **10** topic clusters; canonical new lecture ID `internal-medicine-ii-dermatology-introduction`.

## Independent source re-check — 2026-10-16 (PDF reattached)

- The original **10-page A4 image-only PDF** was supplied again in the continuation chat and visually inspected page by page. No selectable PDF text was assumed and no OCR was used as an authority.
- The review compared the printed teaching claims to the 11 Explanation sections, 30 MCQs and their keys/rationales, 16 synthetic cases, 70 core shorts, 17 detailed shorts, 14 image-spot prompts/answers and 41 rapid cards on this PR. No clear contradiction with the printed lecture definitions, size thresholds, numerical values or named examples was identified in this pass.
- Reconfirmed anchor points: **1/7 total body weight, 1.75 m²**, the three skin layers and four named keratinocyte layers, eccrine versus apocrine drainage/sites, eight skin functions, morphology distinctions using **<1 cm and >1 cm**, secondary pustule, cyst **wall**, erosion **without scar** versus ulcer **usually with scar**, and both forms of atrophy.
- The source says **less than** or **more than** 1 cm, but does not state how to classify a lesion **exactly 1 cm**. The draft does not create an invented boundary rule.
- Handwritten annotations and the embedded chat screenshot are visible on the supplied scan, but have **not** been promoted to independent exam facts. If the course instructor expects marginal notes to be examinable, a learner/lecturer must review these separately. The original scanned pages and clinical photographs remain absent from this public repository.
- This is a **source-faithfulness review**, not external clinical guideline validation, professional medical sign-off, image legibility certification, copyright clearance, or authorization to publish. The diagrams still require rendered inspection and the user/instructor still controls final editorial sign-off.

## Publication review checklist

- [x] The source PDF was visually read page-by-page; image-only material wasn't OCR-derived or silently guessed.
- [x] Draft content mapped to all 10 supplied lecture pages and manually cross-compared with the printed text.
- [x] The original PDF and clinical photos are not added to public GitHub.
- [x] New course `internal-medicine-ii`, specialty `dermatology`, new lecture stable ID; all old content and progress schemas unchanged.
- [x] Automated static, Chromium, WebKit and offline checks passed on the functional code head `3df879cd32d6e88ccfbdfcc9b64483b33d8d2d22` ([Actions #38951640866](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38951640866)); subsequent documentation-only commits are not clinical re-review.
- [x] Reattached PDF was independently cross-checked against the draft's printed teaching facts and page-attributed answer content (2026-10-16; see audit above).\n- [ ] Review rendered image spots and infographic on phone and desktop; fix any unreadable text or unsupported graphics.
- [ ] Learner/lecturer confirms the English and Arabic exam-facing content against the original PDF (including the scan's handwritten marginal notes).
- [ ] Reviewer approves the branch and release scope before any merge to protected `main`.
- [ ] After a successful merge, explicitly promote the new Cloudflare Worker version and smoke-test online, offline, source-linked MCQ and saved progress.

**Never claim the lesson is published or medically approved solely because CI passes.**

## PWA and browser verification addendum — 2026-10-16

- Dedicated iPhone and Desktop Safari smoke tests open the actual Dermatology lecture, answer a four-choice MCQ, display the source-linked SVG infographic and check for console errors and iPhone overflow.
- **Offline image completeness:** clicking Save lecture offline also caches the local SVG figures; the saved-state check catches missing figures and enables restoration before losing connectivity.
- Playwright verifies the lecture JSON and all three SVG diagrams can be fetched with the browser explicitly offline. Latest functional-code run [38951640866](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38951640866) passed all three CI jobs.
- Version synchronized to `2026.10.16.3` for future controlled promotion.
- The PDF was **reattached in the continuation chat** and its printed teaching text was independently compared with this draft on 2026-10-16 (audit above). **Learner/lecturer approval, handwritten-note interpretation, graphic legibility, rights clearance and controlled production promotion are still required.**

