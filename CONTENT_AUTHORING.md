# Content Authoring & Lecture Intake

This is the contributor workflow for adding new Medical MEQ Bank content without creating lecture-specific build code.

## Medical visual provenance policy — owner request (2026-10-17)

**Only figures and clinical photographs actually present in the learner-provided PDF may appear as medical lecture images.** The repository must not manufacture new clinical visuals, depict invented lesions, borrow photographs from external sources, or replace original source photographs with AI-generated diagrams.

- Every question's visual must have an identifiable **source lecture, printed PDF page and crop/figure identity**. Explanatory text remains governed by **Lecture-First Policy**; handwritten margin notes belong to the learner and are not extra examinable facts.
- Do not silently substitute an invented figure when an original photo is missing. Display a clear **original source image not yet available** state with its page and a private import workflow.
- Confirm reuse/public distribution rights before publishing the original source scans or individual photographs in a **public** GitHub repo, Worker static assets or shared HTML. Private, user-chosen source-only local imports can remain in IndexedDB on the learner's device without transmitting originals to the app backend.
- The Dermatology pilot uses stable file names `derm-image-001.jpg` through `derm-image-014.jpg`, with all originals cropped from the user's PDF printed layers. Users import these locally, and the source-package manifest maps each ID to original page, bounding box and file hash. Keep the image ID stable through redesigned UI and progress migration.
- Generic infographic functionality remains available for legacy lectures that already include source-authorized figures, but **do not generate a synthetic infographic/clinical image** for future lectures unless the user explicitly changes the original-only medical imagery rule. A text-only comparison or HTML/CSS table can summarize printed definitions without pretending to be source photography.
- Visual provenance and user understanding are different from medical factual approval; a full published exam-facing question still needs printed-source answer review.

## Source of truth

- Human-reviewable lecture content belongs in `lectures/data/<lecture-id>.json`.
- `lectures/catalog.json` owns delivery metadata: course, subject, order, expected counts, and payload schema version.
- Published files in `dist/` are generated and must not be edited or committed.
- New canonical lectures must not add new lecture-specific Python/JavaScript materializers.
- Existing legacy transport inputs in `lectures/materialization.json` remain checksum-verified adapters until their generated outputs can be promoted safely after a green full build.

## Canonical identity

The runtime identity hierarchy is:

```text
course / subject / lecture / item-type / item-id
```

Examples:

```text
surgery/urology/urology-renal-tumors
v2::surgery::urology::urology-renal-tumors::core::rt-core-1
```

Local subject names may repeat between courses. Lecture IDs remain globally unique in payload schema v1 for backward compatibility. Progress keys are course-scoped so existing ratings migrate without collisions.

## Add a new medical course (only once per course)

New courses should be registered as metadata first; do not duplicate the whole engine, frontend or offline/PWA code.

~~~bash
python3 tools/add_course.py --id pediatrics --label "Pediatrics" \
  --subject "neonatology=Neonatology" \
  --subject "pediatric-cardiology=Pediatric Cardiology"

# Review the dry-run; register metadata only after confirming the structure:
python3 tools/add_course.py --id pediatrics --label "Pediatrics" \
  --subject "neonatology=Neonatology" \
  --subject "pediatric-cardiology=Pediatric Cardiology" --write
~~~

A new course starts empty by design. The first approved lecture links it to the shared lecture catalog. Existing Surgery and Medicine packs, published IDs and progress are unchanged.

## Add a lecture

Start from a draft for any course/subject that already exists in `courses/catalog.json`:

```bash
python3 tools/new_lecture.py --course internal-medicine --subject cardiology \
  --title "Heart Failure" --source "Heart-Failure-Lecture.pdf"
```

This creates an **unpublished, intentionally empty** `tmp/lecture-drafts/cardiology-heart-failure.json`. It does not extract PDF facts or publish placeholder content. Populate the medically reviewed `subtopics`, `cases`, `coreShorts`, `imageQuestions`, `detailedShorts`, and `rapid` using the lecture PDF only.

The five existing practice modes remain the **current production contract**. An optional **studyGuide** extension is now schema-validated in this authoring branch. Its browser renderer and tests are developed separately in V2 PR #23. A schema-only change does not make new modes live until both components are merged, quality-gated and promoted.

Run a safe dry-run:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery
```

The command validates the structure, item IDs, priorities, marks, subtopics, answers, images/page references, target course/subject, duplicate IDs, and duplicate course/subject order. It also derives all catalog counts.

If the dry-run is correct, register it:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery --write --reviewed
```

The write mode:

1. requires an explicit medical content review acknowledgment (`--reviewed`);
2. validates the entire payload, stable identifiers, available subject and local/embedded images **before mutating repository files**;
3. stages canonical JSON + catalog (+ course-pack link for the first lecture), installs with rollback if a filesystem write fails;
4. keeps the historical Surgery compatibility baseline **frozen**; new Surgery lectures are additive and cannot silently redefine the old protected fixtures.

Then run the canonical static quality gate:

```bash
npm run quality:static
```

This single command builds `dist/` and runs the shared source, data, repository, performance, image-integrity, and JavaScript syntax checks. Do not repeat individual validators manually unless diagnosing a specific failure.

Browser verification must also pass in Chromium and WebKit before production promotion:

```bash
npm ci --no-audit --no-fund
npm run test:e2e
npm run test:webkit
```


## Optional approved Study Guide (Explanation + MCQ + Infographic)

New lectures may contain an additional **studyGuide** object. It does not change the five existing arrays, saved item IDs, course catalogs or progress keys. The field is omitted completely for old lectures.

~~~json
{
  "studyGuide": {
    "explanation": [{
      "heading": "Verified lecture section heading",
      "paragraphs": ["Arabic explanation with the exact English medical terms from the lecture."],
      "sourcePage": "PDF slide 3",
      "understandingAids": ["Clearly separated comprehension aid, not an exam fact."]
    }],
    "mcqs": [{
      "id": "newlecture-mcq-01",
      "question": "Question derived from the lecture?",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "answerIndex": 1,
      "rationale": "Why the lecture supports choice B.",
      "sourcePage": "PDF slide 4"
    }],
    "infographic": {
      "image": "./assets/lectures/newlecture-summary.png",
      "alt": "Precise textual summary of the lecture diagram",
      "caption": "Reviewed illustration, not extra exam content",
      "sourcePage": "PDF slide 5"
    }
  }
}
~~~

This is **a structural placeholder example, not medical lecture content**. Replace the heading, page numbers, text, options and image with reviewed PDF-specific material. Explanation paragraphs, understanding aids, MCQ options/rationales and infographic alt text are plain text, not trusted HTML. Never place unreviewed source claims in these fields. Optional parts may be omitted individually; no empty guide may be published.

Only approved PNG, JPEG, WebP or AVIF images are accepted as local assets or embedded base64. Missing media paths, attempts to escape the assets folder and unsupported URLs fail the registrar. The standalone offline exporter embeds local study-guide infographics so one-file study copies do not gain new external dependencies (subject to the existing 8 MB export budget).

**Implementation sequence:** register optional guide after PDF content review in PR #24, merge the matching safe-render UI implementation in PR #23, confirm Chromium/WebKit, then promote explicitly. The MCQ answers remain separate from existing Mastered/Review/Weak counters until a future progress-schema design is reviewed.

## Payload and metadata versions

Two versions are intentionally separate:

- `lectures/catalog.json.schemaVersion = 2` describes the current catalog metadata contract.
- each lecture catalog entry currently declares `schemaVersion = 1`, the current medical content payload contract.

The publisher adds `schemaVersion`, `courseId`, and `canonicalId` to generated delivery JSON without rewriting the human-reviewed medical source.

Unsupported payload versions fail closed. A future payload v2 requires an explicit migration utility and corresponding progress compatibility plan before it can be published.

## Media rules

Image questions must contain either an approved image source or a lecture-page reference. Materialized AVIF assets retain byte length and SHA-256 integrity metadata. Search indexes explicitly exclude embedded image/base64 data.

Do not introduce a new binary transport or lecture-specific repair path for ordinary new lectures.

## Release rule

Adding content is not complete when JSON is merely committed. It is complete only after the full build, data validators, Chromium tests, WebKit tests, accessibility checks, offline tests, and performance budgets pass.

## Chat-to-website lecture handoff (PDF → reviewed content → release)

1. **Receive:** The learner uploads the original PDF here in ChatGPT and identifies the target course and specialty. Review source readability and slide/page numbering. Ask for missing source pages rather than making up clinical content.
2. **Lecture-first content:** Explain the PDF in simple Arabic with the necessary English terms, keeping lecture classifications, numbers and management exactly as taught. Any out-of-source comprehension help is explicitly labeled **Understanding Aid — Not an additional exam fact**.
3. **Practice content:** Generate MEQ cases, short and detailed questions, lecture-linked image/spot questions and Rapid Recall, each traceable to the supplied lecture. MCQs and infographic source figures belong to the new optional **studyGuide** contract (with mandatory source-page references), never silently relabeled as core shorts. Publish these modes only when the matching UI branch has passed its own tests.
4. **Review checkpoint:** Show a content coverage table (source pages → subtopics → questions → visual references), highlight unreadable diagrams/ambiguities and obtain content approval. Images should be licensed/permissioned or sourced from the user-supplied material; don't publish an entire copyrighted PDF just to serve one illustration.
5. **Stage:** Generate the reviewable canonical JSON draft. Attach full media under the repository `assets/` directory with **safe local paths**, or use a supported inline image type. Do not invent a figure: page-only questions remain labeled page references, not displayed as an original figure.
6. **Check:** Run `tools/add_lecture.py ... --course <id>` without `--write`. Check counts, source notes, media, duplicate IDs, subtopic mapping, and actual subject/lecture identity. Correct any error, then commit with `--write --reviewed` only after explicit medical review.
7. **Release:** Run `bash build.sh`, Chromium, WebKit and the full protected PR checks. Do **not** edit `dist/` by hand; do **not** mutate past item IDs. GitHub merge and manual Cloudflare Worker promotion are separate controlled steps; smoke-test online/offline, images, search and saved progress.

### Non-negotiable source and data rules

- No external guideline or drug/procedure updates in an exam-facing lecture unless present in its PDF.
- Neither the drafting tool nor the static site has an AI medical-fact extractor. ChatGPT's evidence-based content preparation happens *before* insertion and remains reviewable.
- Don't rename a published lecture or question merely to reorder the UI; IndexedDB progress keys depend on stable IDs.
- The website is public. Review redistribution permission and remove private student/patient details before pushing a lecture source or its illustrations to GitHub.
- Drafts in `tmp/lecture-drafts/` are ignored by Git. Public content only comes from a reviewed commit and release.


### Source-original photo packaging & verification (V3 pilot)

For a lecture where the source file has real clinical photographs, extract **only** its printed original photographs from the learner-supplied PDF, not synthetic clinical drawings, online replacements or generated visuals. Preserve a private pack manifest with stable item ID, printed page, crop coordinates and SHA-256 of each JPEG. The Dermatology V3 pilot is pinned to 14 JPEGs from `Dermatology Department book 2022.pdf`.

- **Public repo:** lecture text/questions + page attribution + approved SHA-256 fingerprints and import controls are allowed. Do not publish the source-book PDF, crops, handwritten annotations, or clinical photos without the copyright holder's permission.
- **Private learner import:** the V3 prototype accepts the owner-provided ZIP or extracted exact JPEGs, verifies source hashes locally and persists the files in IndexedDB. A wrong image with a correct filename is rejected and never relabeled as original.
- **Offline:** imported photos persist only in the current browser/device storage and are not included in normal question-progress backup JSON; a separate **personal offline review HTML** may bundle the originals for the original PDF owner. A local photo pack is not automatically a licensed public asset.
- **New lectures:** add a generic provenance-first intake/manifest pipeline before expanding beyond the Dermatology pilot; never simply copy hard-coded image arrays or invent medical diagrams when a lecture is missing figures.
- **Study Guide:** source-photo atlas displays authentic originals when verified, and a clear source-not-imported message otherwise. Printed text remains the only exam authority; handwritten notes are solely personal understanding aids.



## Reusable original-PDF photo intake (all subjects, no synthetic images)

The source-image importer is now metadata-driven. **You no longer edit src/app.js or copy a Dermatology-specific array to add another lecture.** Each reviewed image-spot question has:

- A stable `id` such as `some-lecture-image-001`, and source `page` from the printed PDF.
- No public `image` URL if reuse rights are unconfirmed.
- `imageSha256` (64 lowercase hexadecimal characters) pinning the actual source JPEG crop; optional `imageBytes` provides its size.
- The exact original JPEG, private to the student, named `<image-question-id>.jpg`. The renderer discovers the source images by these fields regardless of course/specialty/lecture ID.

For reliable authoring, crop from the original uploaded PDF's **printed full-page JPEG layer**, never a fabricated redraw, web stock image, screenshot containing personal handwritten annotations, or up-to-date external textbook figure. If a PDF is vector-based rather than a printed JPEG background, the automatic extractor refuses to guess and a reviewer must manually extract and verify the true original. Medical facts and answer keys still obey Lecture-First Policy.

### One command to prepare a private photo ZIP

The crop map is a locally reviewed JSON file outside the public repo, with entries like:

```json
{
  "items": [
    {
      "id": "some-lecture-image-001",
      "sourcePage": 4,
      "cropNormalized": [0.21, 0.34, 0.50, 0.56],
      "description": "Review against the printed source image"
    }
  ]
}
```

Map **every** source image question, verify each coordinate visually, and keep the original PDF in a private folder. This illustrative coordinate example is *not* a medical figure or an exam fact.

```bash
python3 -m pip install -r tools/requirements-original-figures.txt

python3 tools/prepare_original_figure_pack.py \
  --source-pdf "/private/Lecture.pdf" \
  --lecture "/private/lecture-draft.json" \
  --crop-map "/private/reviewed-crop-map.json" \
  --private-zip "/private/Lecture_Original_Figures.zip"

# Only after verifying every printed PDF crop and page label:
python3 tools/prepare_original_figure_pack.py \
  --source-pdf "/private/Lecture.pdf" \
  --lecture "/private/lecture-draft.json" \
  --crop-map "/private/reviewed-crop-map.json" \
  --private-zip "/private/Lecture_Original_Figures_REVIEWED.zip" \
  --write-reviewed-hashes
```

For an existing reviewed lecture, changed crop output intentionally fails a hash check; an explicit `--replace-existing-hashes` (combined with `--write-reviewed-hashes`) is required after a second medical/source-photo review. The packaging tool writes its ZIP **outside the public repo** and does not upload it or publish the source PDF.

The browser reads the JPEG file hashes from each lecture automatically, accepts the matching private ZIP or multiple JPEGs, saves them in IndexedDB, displays them in the source-image atlas and exam spots, and preserves text/MCQ/case progress separately. Private photos are device-local and **not** in a normal study-progress backup; the user should retain the source ZIP to restore photos on another device.


### Keeping new source-image lecture UI independent of course-specific code

The user-facing source-photo gallery and device-local photo importer are **not per-lecture hand-coded**. For each approved image spot, the canonical JSON includes `id`, `page`, `prompt` and the SHA-256 of the actual reviewed source JPEG as `imageSha256`, with **no** public `image` reference unless public use is licensed. The current app detects those image slots automatically under any course/department, and device-local imports are scoped to `<lecture-id>::<image-question-id>` to avoid collisions between courses.

Run `bash build.sh` and the Chromium/WebKit quality matrix after changing source hashes or lecture IDs. Legacy published AVIF images continue under a separate, strict embedded-media integrity rule. A successful source-image hash check **does not confer copyright permission**.



### Verify the complete PRIVATE image pack before lecture registration

The prep step produces a ZIP and JSON provenance manifest; before delivering a source-photo pack, check **every** original crop is present, its JPEG hash matches the source-question metadata, the printed PDF page is consistent, and there are no renamed or extra files:

```bash
python3 tools/check_original_figure_pack.py \
  --lecture "/private/reviewed-lecture.json" \
  --private-zip "/private/Lecture_Original_Figures_REVIEWED.zip"
```

A successful check prints `VERIFIED: N original PDF figures`. An incomplete pack, wrong fingerprint, unexpected path or mismatched page fails with a nonzero exit code and must **not** be distributed. The command reads privately; it does not extract a JPEG to disk, upload a book photograph, or permit publishing copyrighted source photos publicly. It does not replace the human check of what the photographed lesion depicts.

Tests in `tests/test_original_figure_pack.py` use nonclinical fixture bytes only to prove invalid filenames, missing photos and forged manifests fail. They are included in the regular `bash build.sh` quality gate, along with the existing clinical/lecture intake integration tests.
