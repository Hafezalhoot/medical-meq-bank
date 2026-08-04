# Medical course content packs

The application engine is shared by every medical course. A course pack declares the hierarchy and points to one or more lecture catalogs; it does not duplicate the UI, progress store, print center, PWA, or offline runtime.

## Hierarchy

`Course → Subject → Lecture → Subtopic → Study item`

- `courses/catalog.json` registers published courses and the default course.
- `courses/<course>/course.json` declares subjects and lecture catalogs for one course.
- `lectures/catalog.json` remains the reviewed Surgery lecture registry.
- Lecture JSON files retain globally unique lecture IDs and stable item IDs.

## Adding another course

1. Add a course manifest that validates against `courses/course.schema.json`.
2. Register it in `courses/catalog.json`.
3. Add its independent lecture catalog and reviewed lecture JSON files.
4. Keep every lecture ID globally unique.
5. Never rename a published lecture or item ID merely to reorganize the UI; saved progress uses the historical `lecture::type::item` key.
6. Run the course-pack validator, complete browser suites, and offline/PWA checks before merging.

## Compatibility contract

The frozen Surgery baseline in `tests/fixtures/legacy-surgery-baseline.json` protects all previously published lecture IDs and counts. A new Medicine, Pediatrics, Obstetrics & Gynaecology, or other pack must not modify those entries or alter their saved progress.
