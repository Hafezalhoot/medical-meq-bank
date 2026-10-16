# Medical course content packs

The application engine is shared by every medical course. A course pack declares the hierarchy and points to one or more lecture catalogs; it does not duplicate the UI, progress store, print center, PWA, or offline runtime.

## Hierarchy

`Course → Subject → Lecture → Subtopic → Study item`

- `courses/catalog.json` registers published courses and the default course.
- `courses/packs/<course-id>.json` declares subjects and lecture catalogs for one course.
- `lectures/catalog.json` remains the reviewed Surgery lecture registry.
- Lecture JSON files retain globally unique lecture IDs and stable item IDs.

## Adding another course

1. Prefer the safe command: python3 tools/add_course.py --id <course-id> --label "<Course>" --subject "<id>=<Label>" --write. Its default is a dry-run.
2. Each generated course pack validates against `courses/course-pack.schema.json`.
2. Register it in `courses/catalog.json`.
4. Register reviewed lecture JSON through tools/new_lecture.py then tools/add_lecture.py --write --reviewed; the tool connects the course to the shared catalog.
5. Keep every lecture ID globally unique.
6. Never rename a published lecture or item ID merely to reorganize the UI; saved progress uses the historical `lecture::type::item` key.
7. Run the course-pack validator, complete browser suites, and offline/PWA checks before merging.

## Compatibility contract

The frozen Surgery baseline in `tests/fixtures/legacy-surgery-baseline.json` protects all previously published lecture IDs and counts. A new Medicine, Pediatrics, Obstetrics & Gynaecology, or other pack must not modify those entries or alter their saved progress.
