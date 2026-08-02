# Print Layout v8 - 2026.08.02.8

## User-facing changes

- Added Compact, Standard, and Comfortable A4 margin presets. Compact is the default and uses 7 mm side margins.
- Added Clean and Detailed printed-detail modes. Clean mode retains priority and marks while removing repeated lecture labels, secondary topic tags, timestamps, and the repeated footer.
- Rebuilt manual questions-per-page pagination around fixed A4 page grids.
- Balanced the final two page groups so selecting four questions per page never creates a preventable 4 + 1 orphan split; five short items are balanced as 3 + 2.
- Handwritten worksheet rows allocate the available page height evenly to writing space.
- Long MEQ cases, images, or full model answers are moved to later pages when needed. A genuinely oversized single item is allowed to flow rather than being clipped.
- The first-page title and student fields are measured before pagination, preventing header overlap and false page breaks.
- All existing filters, review statuses, three print modes, PWA/offline support, dark mode, and Back to Top remain intact.

## Verification

- JavaScript syntax checks passed.
- Worksheet, study-inline, separate-answer-key, and compact print modes passed with zero runtime errors or console warnings.
- Eight short questions at four per page produced 4 + 4 in worksheet and study modes with no overflow.
- Five short questions at four per page produced 3 + 2, with no one-question orphan page.
- Full-bank stress test: 301 printable items, 89 generated question pages, no empty pages, no overflow pages, and no preventable one-item final page.
- Rendered A4 PDF inspection confirmed four worksheet questions on each page and four study questions with model answers on each page.
- Back-to-top desktop, mobile, keyboard, modal, and print behavior regression tests passed.
