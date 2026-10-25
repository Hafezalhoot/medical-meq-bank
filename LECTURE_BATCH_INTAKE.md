# Batch lecture intake — many PDFs, no accidental publication

Use this workflow when several lecture PDFs are ready for authoring. It creates **empty, unpublished** source-review drafts, not exam-ready questions, original photo uploads, or generated medical facts.

## 1. Make a private manifest

Create a private file at tmp/lecture-batches/october-2026.json:

~~~json
[
  {
    "course": "surgery",
    "subject": "urology",
    "title": "Lecture One",
    "source": "lecture-one.pdf"
  },
  {
    "course": "surgery",
    "subject": "urology",
    "title": "Lecture Two",
    "source": "lecture-two.pdf"
  },
  {
    "course": "internal-medicine-ii",
    "subject": "dermatology",
    "title": "Lecture Three",
    "source": "lecture-three.pdf"
  }
]
~~~

Choose course/subject IDs already present in courses/catalog.json and the corresponding courses/packs/*.json. ID and order are optional; the tools reserve globally unique lecture IDs and unused per-course/per-subject positions across published lectures and pending default-path drafts.

The source value is a reference filename only. **Do not commit PDFs, patient images, or private source files to this public repository.** Keep the manifest and generated drafts in ignored local tmp/.

## 2. Preview then stage

~~~bash
python3 tools/batch_lecture_drafts.py tmp/lecture-batches/october-2026.json
python3 tools/batch_lecture_drafts.py tmp/lecture-batches/october-2026.json --write
~~~

The first command lists planned identities, source names, draft paths and orders **without writing anything**. The second creates only unpublished draft JSON using exclusive create and rolls back newly created files if writing fails. Existing drafts and all published files are never overwritten. A collision anywhere in the manifest stops the entire batch before writing.

## 3. Prepare and medically review each lecture

For every PDF, produce a **lecture-first**, page-attributed explanation, study questions, original-source image references and optional 4-choice MCQs. Never invent content, distractors, answer keys, medical images or claims absent from the provided PDF. The draft is initially empty on purpose.

Generate a private coverage report for each completed draft:

~~~bash
python3 tools/lecture_review_report.py tmp/lecture-drafts/surgery-urology-lecture-one.json --pdf /private/lecture-one.pdf
python3 tools/add_lecture.py tmp/lecture-drafts/surgery-urology-lecture-one.json --course surgery
~~~

Resolve source-page gaps and review the complete answers and original photo permissions before registration. The review report cannot verify medical accuracy on its own.

After **explicit medical approval**, register each validated lecture with the existing protected command:

~~~bash
python3 tools/add_lecture.py tmp/lecture-drafts/surgery-urology-lecture-one.json --course surgery --write --reviewed
bash build.sh
npm ci --no-audit --no-fund
npm run test:e2e
npm run test:webkit
~~~

Merge only when protected GitHub and Cloudflare checks pass. Confirm the active Worker version after promotion. Keep Cloudflare Access enabled; do not alter previously published IDs or progress data.

## Non-goals

This batch tool does **not** extract PDF text, auto-author clinical questions, populate all five question categories, bypass human approval, bulk-publish to Cloudflare, or claim original-photo redistribution rights. Its job is to safely remove repetitive setup and ID/order collisions while many lectures are being prepared.
