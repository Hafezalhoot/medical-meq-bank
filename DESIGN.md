# Medical MEQ Review Bank — Design System V4

**Stage:** Established V4 design contract; verified V4.3 source `2026.10.26.3`, V4.4 bilingual-reader increment pending exact-head verification.  
**Source of truth:** the actual `src/app.css`, `src/index.html`, `src/app.js`, source-linked medical content and test evidence. **Progress:** [MEQ_UI_UX_V4_PROGRESS.md](MEQ_UI_UX_V4_PROGRESS.md).

## Product and primary job
A personal, offline-capable medical-exam preparation workspace. The user visits to **resume studying the next relevant question**, view source-based teaching material, correct mistakes and start an exam—not to browse a promotional landing page. Build around **Operate** for selectors, filters, saving and exam sessions; use **Read** for bilingual explanation, dense diagnostic tables and original PDF figures.

## Established visual language (preserve)
- **Brand:** quiet clinical ink teal rather than unrelated blue/purple gradients.
- **Light:** background `#f4f7f6`, cards `#fff`, text `#17343e`, muted `#566c72`, lines `#d9e5e3`, primary teal `#0d6267`, soft teal `#e7f4f3`.
- **Dark:** background `#101c20`, surfaces `#16262b`, text `#eaf5f3`, secondary `#b5c9c9`, line `#32464a`, accent `#82d2c8`. All ordinary text/control labels target WCAG AA 4.5:1; visible focus and selected states require additional non-color cues.
- **Type:** familiar Inter / Segoe UI / Tahoma / Arial fallback; medical body text >=16px where reading matters, roughly 1.6 English line-height, about 2.0 for long Arabic notes, constrained reading measure ~70–80ch. Do not over-style headings at the expense of scanning.
- **Depth:** light borders and restrained shadows, no generic shadow-on-shadow cards. Source figures themselves are the important visual media; **do not generate substitute clinical images**.
- **Motion:** subtle state feedback only; obey `prefers-reduced-motion`.

## Study information hierarchy
1. **Course & Specialty** (existing selectors) with one prominent **Start/Continue studying** CTA.
2. **Exam mode** available without hunting for it, visually subordinate to the main action.
3. **Secondary discovery** (Course Library, My Review/Daily Weak, search & filters, stats) in existing progressive disclosures / sticky filters rather than another competing dashboard.
4. **Lecture & Topics** rail / mobile nav, stable across filter changes and refresh.
5. **Study content** in a single reading column: source-first Explanation/MCQ, exact original Figure Gallery, MEQ, Shorts, Rapid. Rich source pages remain readable without horizontal document overflow.
6. **Error/recovery**: PWA updates, offline, source unavailable, no matching items and backup/restore tell the student what to do next, not silently fail.

## V4 original-figure study reader
- Keep existing original figures and page metadata; never rewrite/crop them at runtime or fetch unsourced replacement images.
- The gallery previews should be readable and selectable; use two columns on typical desktop reading width, one on phones.
- A native, focus-trapped `<dialog>` shows the **exact original JPEG** with its source page. Buttons provide **Zoom in, Zoom out, Fit, Close, Open original file and Study figure questions**. Escape closes it; link modifier-clicks still open the original as before.
- Zoom is display-only; it never modifies content. Users may scroll the enlarged image within the dialog rather than expanding the entire page.
- Use button titles, keyboard focus, visible state, no guessed answer keys, no image replacements.

## Bilingual scientific reading & original media
- Arabic Explanation and Understanding Aid paragraphs frequently begin with Latin medical terms. `dir=auto` alone makes those paragraphs LTR; use explicit `dir=rtl` and `lang=ar` when they contain Arabic script, while preserving the exact lecture source wording and genuinely English-only paragraphs.
- Scientific source-page references and image captions are study content, not decorative metadata. Aim for at least ~14px at 320px mobile size and >=16px for body notes. Constrain longer reading sections near 76ch and preserve readable line heights.
- Original image zoom must accept both hosted trusted JPEG URLs and **locally verified same-origin blob URLs** used after importing approved private source JPEGs. Never accept arbitrary remote external image replacements.
- Evidence requires the real mixed-script Anxiety paragraph, original printed figures, dark/light mobile reading, keyboard and 320px document overflow checks.

## Component contracts and states
| Surface | Intent | Important states |
| --- | --- | --- |
| Start/Continue CTA | Resume saved Weak/Review or next unrated item | Enabled/disabled for empty specialty, keyboard focus, selected course |
| Course/Subject selection | Find lecture with minimal taps | Long specialty names, mobile 320px, empty course |
| Study list and sidebar | Context, question controls and source | Active item, hidden filter, collapse/focus, no-match |
| Source figure viewer | Read dense DSM tables & jump to actual questions | Native open/close, zoom/fit, missing original, browser back/new tab |
| Exam | Immediate correctness for approved MCQs, weak marking | In progress, saved, submit, timer, break/recovery |
| Progress and review | Saved Weak/Review/Mastered with no accidental loss | New, rated, offline, restored; stable IDs |
| PWA | Stay usable offline and after updates | Fresh/stale, offline assets, Access callback pass-through |

## Viewport rules
- **320/390px:** compact title, course and specialty native controls, primary action visible without the secondary chrome overtaking the viewport. Lecture content can be reached by one obvious tap. Use single-column original figure gallery and a near-fullscreen dialog.
- **768px:** selectors and controls must reflow meaningfully; no sideways document scrolling or nested scroll traps.
- **1280/1440px:** compact top chrome, one quiet lecture navigation rail, wider source reading pane and accessible full-size visual reader.
- 200% browser zoom, long course names, mixed Arabic/English/RTL and device safe areas require real tests, not assumptions.

## Implementation and release discipline
- Vanilla HTML/CSS/JS, reuse existing `src/` modules, native `dialog`, `details`, `select` and CSS. Avoid new frontend libraries or a full framework rewrite.
- Protect all stable lecture IDs, ratings and the lecture-first PDF source policy. Keep backup/restore and print.
- Use Playwright Chromium + WebKit + axe, screenshots at important sizes, actual original-source imagery; evaluate focus, contrast, overflow, data and interaction separately.
- Cloudflare release verification is independent from GitHub source checks. Protected Access production smoke issue #35 and gated promotion issue #50 remain tracked.
- Amend this document only when the implemented design language actually changes. Record task-level status in the companion progress tracker.

## Progressive lecture discovery (V4-04a)
- Keep the existing course/specialty controls and sidebar lecture links as the familiar path; don't substitute a large new dashboard.
- For a specialty with 5 or more lectures, add a local **Find a lecture** input inside the lecture-navigation rail, filtering only titles/orders. This is distinct from the central question search and never loads a lecture just to find its title.
- Result count is announced with a polite status; the empty state offers Clear search. Escape clears without navigating. Switching course/specialty resets the query.
- The input stays hidden for short specialties to avoid adding clutter; on mobile the existing Lectures toggle reveals this same control. Do not store the query in progress/backup storage.

## Mobile study density — third increment
- The 320–390px hero already contains Course + Specialty selectors; avoid repeating both labels in a multi-line breadcrumb immediately below. Show the current lecture name prominently and leave the complete Course / Specialty / Lecture breadcrumb at >=701px.
- Progress disclosure keeps its text percentage and native expand/collapse action; on mobile remove the redundant tiny decorative progress track from the summary, **not** the detailed stats or accessible values.
- Long lecture titles may wrap naturally. Never truncate medical terms into ambiguous labels or change the PDF-source content just to fit the layout.
