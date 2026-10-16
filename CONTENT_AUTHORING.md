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

Prepare one canonical JSON file using the v1 content contract in `lectures/lecture.schema.json`.

Run a safe dry-run:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery
```

The command validates the structure, item IDs, priorities, marks, subtopics, answers, images/page references, target course/subject, duplicate IDs, and duplicate course/subject order. It also derives all catalog counts.

If the dry-run is correct, register it:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery --write
```

The write mode:

1. stores the canonical reviewable JSON under `lectures/data/`;
2. adds the versioned/scoped catalog entry;
3. connects a course to the shared lecture catalog when it receives its first lecture;
4. updates the Surgery compatibility baseline when applicable.

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
