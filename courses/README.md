# Medical course content packs

The application engine is shared by every medical course. A course pack declares the hierarchy and points to one or more lecture catalogs; it does not duplicate the UI, progress store, print center, PWA, or offline runtime.

## Hierarchy

`Course → Subject → [optional Chapter] → Lecture → Subtopic → Study item`

- `courses/catalog.json` registers published courses and the default course.
- `courses/packs/<course-id>.json` declares subjects and lecture catalogs for one course.
- `lectures/catalog.json` remains the reviewed Surgery lecture registry.
- Lecture JSON files retain globally unique lecture IDs and stable item IDs.

## Optional Chapters (V6 UX-02)

Chapters organize **multiple lectures inside a single specialty**. They are optional and **not the same as lecture subtopics**. Existing subjects without chapters still show their lectures directly.

To add reviewed Chapter metadata, edit only the subject's entry in `courses/packs/<course-id>.json` and link the relevant lecture catalog rows. For example (illustrative labels, **do not publish these assignments as medical facts**):

```json
{
  "id": "urology",
  "label": "Urology",
  "order": 1,
  "chapters": [
    {"id": "foundations", "label": "Foundations", "order": 1},
    {"id": "oncology", "label": "Oncology", "order": 2}
  ]
}
```

A matching entry in `lectures/catalog.json` can then set `"chapterId": "oncology"` *without changing its existing ID, courseId, subjectKey, order, original source payload, question IDs, answer keys or ratings*. A lecture with no `chapterId` appears under **Other lectures** when chapters exist.

Every Chapter ID and positive order must be unique within its **own subject**, and `chapterId` may reference only a Chapter in the lecture's subject/course. The Python validator enforces this, and the offline HTML embeds the chapter mapping from the verified catalog. A Chapter is never generated automatically from a lecture's wording; confirm grouping first.

Run `python3 scripts/validate_course_packs.py` (or `bash build.sh` for the full build), and test the online Library and offline file. In a future UX-05 phase, these edits will be driven by a private review-first Manage Library wizard; the current process is intentionally reviewed metadata, not automatic publishing.

## Adding another course

1. Prefer the safe command: python3 tools/add_course.py --id <course-id> --label "<Course>" --subject "<id>=<Label>" --write. Its default is a dry-run.
2. Each generated course pack validates against `courses/course-pack.schema.json`.
3. Register it in `courses/catalog.json`.
4. Register reviewed lecture JSON through tools/new_lecture.py then tools/add_lecture.py --write --reviewed; the tool connects the course to the shared catalog.
5. Keep every lecture ID globally unique.
6. Never rename a published lecture or item ID merely to reorganize the UI; saved progress uses the historical `lecture::type::item` key.
7. Run the course-pack validator, complete browser suites, and offline/PWA checks before merging.

## Compatibility contract

The frozen Surgery baseline in `tests/fixtures/legacy-surgery-baseline.json` protects all previously published lecture IDs and counts. A new Medicine, Pediatrics, Obstetrics & Gynaecology, or other pack must not modify those entries or alter their saved progress.
