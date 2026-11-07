# Guided library intake — UX-05A

Continue the real V6 chain from UX-04A `dd89bf5fb6c4c446f2041583eef2322e9a06f9a5`, rather than rebuilding the older main screen. The user delegated the next unblocked implementation slice and requested continued development without another goal interview.

## Scope and decisions

Add a separate `#/manage` screen, reached through Study tools. Keep the five learner navigation destinations. A four-step form selects an existing Material (course), specialty and optional authored Chapter, collects lecture title/stable ID/order/source PDF filename, collects topic headings, then previews and downloads a metadata-only intake file. Browser Back and route switches preserve the in-memory form. Reload clears it, explicitly stated. No clinical text, answer keys, PDF upload or approval checkbox is generated.

The existing vanilla JS PWA, V6 sage tokens and native controls are the implementation authority. A separate small authoring module is preferable to enlarging app.js; a new framework or backend would create migration and credential risks without helping this local draft flow. Existing course/subject/Chapter creation remains the repository authoring workflow; this slice does not pretend to be a complete authenticated CMS.

## End-to-end contract

Export `{format: 'medical-library-intake', version: 1, status: 'needs-source-review', lecture: {course, subject, chapterId?, title, id, order, source, topics}}`. Topics are `{id, label}` with initial `topic-1` etc IDs, independent of language. IDs become permanent only after reviewed publication. Source is a PDF filename, not verified PDF evidence.

`tools/import_library_draft.py` validates strict fields, existing course/subject/Chapter, title/ID/order collisions using `new_lecture.prepare_draft`, and topic uniqueness. Default is preview; `--write` creates one private draft exclusively, never overwrites, never changes catalogs. A selected Chapter stays as draft metadata; `add_lecture.py` validates it and transfers it only to the catalog after the existing content/review gate. Empty drafts cannot be registered. Real PDF review, figures, MCQs and release remain the established workflow.

## Acceptance

- Only one wizard step is visible; labels, inline errors, Back/Next and review are keyboard usable, 44px targets, no overflow at 320/390/768/1440, light/dark, Arabic headings.
- Changing scope resets dependent Chapter and recomputes order/ID before review. Duplicate IDs, normalized titles, used orders, duplicate topics and invalid sources fail before export and again at CLI import.
- Export works in online and standalone/offline output. No learner progress, content payload, source figures, scoring or existing fixtures are rewritten.
- Static, full Chromium and WebKit gates, including existing exam/images/storage/offline tests, must run. New CI must be checked against exact final SHA before merge. Production remains held if Access/build-only settings are unverified.
