# Medical Study Workspace V2 — UX Audit and Product Design Brief

**Evidence:** source-tree inspection on the merged `2026.10.04.2` baseline, `src/index.html`, `src/app.css`, `src/app.js`, `src/course-packs.template.js`, `src/lecture-loader.js`, course/lecture catalogs and existing Playwright tests.  
**Limit:** this is a source-backed UX audit, not a pixel-by-pixel review of the live Worker in a visual browser. No production screenshot score is claimed.  
**Design intelligence:** UI/UX Pro Max (accessible LMS course grid + clinical content-first workspace), adapted to the repository's established blue/teal tokens and offline-first constraints.

## Current experience — findings ranked by product impact

| Priority | Source-backed issue | User impact | V2 direction |
| --- | --- | --- | --- |
| High | Course and specialty selection are embedded in one hero panel; no course-level discovery before V2. `src/index.html`, `src/course-packs.template.js`. | Many future courses would be hard to scan from long native selectors. | Catalog-driven Course Library, then a separate Study Home and recently visited content |
| High | `Internal Medicine` contains configured specialties but no reviewed lecture catalog. `courses/packs/internal-medicine.json`. | Selecting an empty specialty looks like a blank app. | A clear empty state with a Browse Courses recovery action; no invented medical material |
| High | Product identity and copy remain `MEQ Review Bank`, even though a course registry and multiple question styles already exist. | Learners may overlook capabilities outside Surgery/MEQ. | Introduce Medical Study Workspace as product language while preserving legacy links/test contracts until a coordinated release |
| High | Current navigation surfaces lecture and subtopic sidebars with top-level filters in the same workspace. `src/index.html`. | New students face multiple competing navigation surfaces. | Progressive disclosure, one study path and contextual navigation rather than opening all panels by default |
| High | No dedicated `continue last lecture` overview across courses, despite per-course remembered lecture IDs in `src/app.js`. | Returning learners take extra steps to resume studying. | Metadata-only Study Home with continue and high-priority review cues |
| Medium | Core question types are fixed in renderer logic (cases, core, images, detailed, Rapid Recall). `src/app.js`. | Explanation/MCQ/illustrated study material needs a schema and explicit source-review plan. | Add optional typed modules only after lecture-first review; keep existing bank stable |
| Medium | Global app/backup controls live in the hero next to study controls. | Utility density competes with the main study task on phones. | Secondary utility menu/section, with install and backup discoverable but less prominent |
| Medium | Large CSS modules combine legacy overrides and current UI rules. `src/app.css`. | Future visual changes can create inconsistent cascades. | Consolidate tokens/components after the current UI behavior is tested; do not start a risky rewrite |
| Medium | Current overall/core stats describe the selected specialty, not a full cross-course plan. | Little insight into what to revise across a semester. | Add scoped course progress and actionable Review/Weak queue when existing data supports it |
| Low | Main interface still shows a comprehensive set of data controls on desktop. | Power users value them; beginners can be overwhelmed. | Preserve power-user functionality but progressively reveal advanced filters |

## Product information architecture

```
Study Home (recent course + resume + review priorities)
  ├── Course Library
  │     └── Course
  │          └── Specialty
  │               └── Lecture
  │                    ├── Explanation (only with reviewed material)
  │                    ├── Clinical Cases / MEQ
  │                    ├── Core & Detailed Questions
  │                    ├── Image / Spot Questions
  │                    └── Rapid Recall
  ├── My Review (Mastered / Review / Weak)
  └── Utilities (Offline packs / Progress backup / Print / Appearance)
```

## The primary medical study flow

Start on the last active course when returning. Highlight the next meaningful action. Make course and specialty navigation explicit. Keep the lecture's reviewed source visible. Offer the existing study views without burying them under utilities. Mark review confidence using the established progress store. Recover from empty lectures, offline faults, and search/filter dead ends with direct actions.

**Do not build:** fictional lecture counts, auto-generated medical answers, unsupported timed exam scoring, backend accounts, or spaced repetition rules that are not grounded in a reviewed product requirement.

## Design QA to complete

- Desktop 1440/1280: course discovery, long subject names, narrow reading width, hover/focus ordering.
- Mobile 360/390: course library native details, touch targets ≥44px, filter sheet, no horizontal overflow, safe areas.
- Tablet 768/portrait and phone landscape: consistent panels and no content hidden behind sticky controls.
- Dark and light: all text and controls pass contrast; course availability color is not the only status cue.
- Browser checks: keyboard, TalkBack/VoiceOver semantics where feasible, axe/Chromium, WebKit/iPhone, empty source packs, backup/restore, print, offline.
- Performance: opening Course Library reads existing registry only; should not request or render unrelated lecture payloads.
- Publishing: preview PR only; protected main release via verified CI; Cloudflare manual version promotion.

## Implemented in the first V2 branch

1. Responsive, accessible, collapsible Course Library from the course registry — no hard-coded course menu.
2. Each card includes number, title, real specialty count, published-catalog state and action.
3. One-click course activation uses existing state persistence and restores the remembered specialty.
4. Empty future specialty states offer Browse Courses as a recovery action.
5. Test coverage ensures moving between a populated Surgery course and an empty Internal Medicine course does not break the lecture selector.

See `UI_V2_ROADMAP.md` for the phased feature backlog and `PROJECT_PROGRESS.md` for completion status.
