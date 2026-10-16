# Content Authoring & Lecture Intake

This is the contributor workflow for adding new Medical MEQ Bank content without creating lecture-specific build code.

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

## Add a lecture

Start from a draft for any course/subject that already exists in `courses/catalog.json`:

```bash
python3 tools/new_lecture.py --course internal-medicine --subject cardiology \
  --title "Heart Failure" --source "Heart-Failure-Lecture.pdf"
```

This creates an **unpublished, intentionally empty** `tmp/lecture-drafts/cardiology-heart-failure.json`. It does not extract PDF facts or publish placeholder content. Populate the medically reviewed `subtopics`, `cases`, `coreShorts`, `imageQuestions`, `detailedShorts`, and `rapid` using the lecture PDF only.

The five existing practice modes are the **current production contract**; optional standalone Explanation/MCQ/Infographic companions are tracked separately as an additive content extension, and must not be claimed as working until their renderer and schema have been released.

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
3. **Practice content:** Generate MEQ cases, short and detailed questions, lecture-linked image/spot questions and Rapid Recall, each traceable to the supplied lecture. MCQs and infographic design should be prepared for the future optional companion format rather than injected into an unsupported field or silently treated as standard core shorts.
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
