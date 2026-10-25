# Batch lecture preparation (private drafts only)

When you have many source PDFs, prepare draft slots in one operation. This **does not extract medical claims, publish content, upload PDFs or modify a course/lecture catalog**.

Create a local JSON file outside the public repository (for example `/private/lecture-intake.json`):

```json
[
  {"course": "surgery", "subject": "urology", "title": "New Urology Topic", "source": "Lecture-01.pdf"},
  {"course": "internal-medicine", "subject": "cardiology", "title": "Heart Failure", "source": "Lecture-02.pdf"}
]
```

Registered course/subject IDs must match `courses/catalog.json` and the associated course pack. The `source` field is a filename for provenance, **not a PDF-reading operation**. Optional `id` (stable slug) and `order` (positive unique integer) allow reviewed overrides.

1. Preview the entire batch with `python3 tools/batch_new_lectures.py /private/lecture-intake.json`. Every row is checked before output, including IDs/orders already published, existing pending drafts and collisions *within this batch*.
2. Create local private draft files with `python3 tools/batch_new_lectures.py /private/lecture-intake.json --write`. Each file lands at `tmp/lecture-drafts/<id>.json`, excluded from Git. Existing drafts are never overwritten; on a batch write error the newly created files are removed.
3. Fill each JSON using its **original source PDF** only. Include explanation, validated source-page-linked MCQs and source-image provenance where applicable. Use `python3 tools/lecture_review_report.py tmp/lecture-drafts/<id>.json --pdf /private/lecture.pdf` to create a source checklist.
4. Review every medical fact, answer, image and source page; run `python3 tools/add_lecture.py tmp/lecture-drafts/<id>.json --course <course-id>` to validate. **Only after explicit medical sign-off**, register with `--write --reviewed`.
5. Require full static, Chromium, WebKit and Cloudflare build gates before merging/deploying. Preserve existing IDs, student progress and source-photo rights.

This batch tool only reserves *draft* names and order numbers. It does not automatically publish or approve a lecture, process PDFs, or manage concurrent authors on multiple devices. Keep one shared authoring workspace or consolidate drafts before parallel editors submit new material.
