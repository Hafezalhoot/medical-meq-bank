# Medical MEQ Bank — UI Design System

## Product direction

**Style:** Clinical Study Workspace — minimal, content-first, calm, professional.

The interface is a study tool, not a marketing page. Visual hierarchy must always prioritize:
1. where the learner is;
2. what to study next;
3. progress;
4. filters/navigation;
5. secondary app/backup/offline utilities.

**Current V3 identity:** deep ink/teal surfaces and a restrained, clinical reading experience. The blue palette in older V1/V2 CSS is historical, not a token source for new UI. Use the last active V3 values in `src/app.css`; printed exam sheets are a separate, intentionally print-optimized surface.

## Design principles

- **Content before chrome.** Study content gets the widest readable area and strongest hierarchy.
- **One clear study path.** Course → specialty → lecture → subtopic → study item.
- **Calm density.** Enough information for revision without dashboard clutter.
- **Progress is meaningful data.** Progress cards are visually stronger than raw content counts.
- **Stable interaction.** No hover movement that makes controls visually jump.
- **Native/simple first.** Use semantic HTML, CSS and existing runtime patterns before adding dependencies.
- **Offline-aware.** Saved/offline/loading states must be explicit.
- **Accessibility is structural.** Keyboard, focus, labels, reduced motion, touch target size and contrast are release requirements.

## Core tokens

### Color

| Token | Light (V3) | Dark (V3) | Purpose |
| --- | --- | --- | --- |
| `--bg` | `#F4F7F6` | `#101C20` | Workspace background |
| `--card` / `--surface` | `#FFFFFF` | `#16262B` | Primary study panels |
| `--text` | `#17343E` | `#EAF5F3` | Primary text |
| `--muted` | `#566C72` | `#B5C9C9` | Secondary labels and prose |
| `--line` | `#D9E5E3` | `#32464A` | Panel borders and separators |
| `--brand` | `#0D6267` | `#82D2C8` | Primary action, active study links |
| `--brand2` | `#0F766E` | `#66C3B4` | Secondary brand use |
| `--brand3` | `#08474D` | `#C7EEEA` | High-emphasis teal |
| `--brand-soft` | `#E7F4F3` | `#223F40` | Selected states |
| `--surface-soft` | `#F2F7F6` | `#1C3237` | Input/section background |
| `--surface-subtle` | `#EDF4F2` | `#20383C` | Quiet supporting surfaces |
| Mastered / Review / Weak | Existing semantic success / warning / danger styles | Existing dark semantic counterparts | Revision-state meaning |

These are **observed source tokens**, not a proposed visual palette. For new components, prefer existing semantic tokens over literal per-component colors. Measure normal text contrast at least 4.5:1 and non-text meaningful boundaries at least 3:1 against the *actual* composed background, including both themes. Never apply the dark brand foreground on its own dark background.

### Spacing

Use a 4/8px rhythm:
- 4 — micro gap
- 8 — control/icon gap
- 12 — compact padding
- 16 — standard component padding
- 24 — section spacing
- 32+ — major section separation

Avoid arbitrary spacing values unless required by an existing asset or responsive constraint.

### Radius

- 10–12px — controls
- 14–16px — cards
- 18–22px — major containers
- Pills only for compact metadata/status

### Elevation

- V3 uses crisp borders and almost-flat card surfaces; do not restore large V1/V2 floating-card shadows.
- `--shadow-sm` is reserved for subtle hierarchy where needed, and dark theme currently removes it.
- A modal may use elevation for separation, but never stack heavy glows or blur on all panels.

### Typography

Use the existing offline-safe system font stack. Do not introduce external web-font dependencies just for style.

Hierarchy:
- H1: product/current workspace
- H2: lecture/major study section
- H3+: nested medical content
- body: minimum readable web size, ~1.5–1.6 line height
- long prose: target 65–75 characters per line

## Page anatomy

### 1. Header / Hero

Purpose: identify the product and choose Course + Specialty.

Rules:
- compact, not marketing-height;
- one H1;
- utilities are secondary;
- current specialty/content tags are supportive only;
- course/specialty selector is the dominant control in the right panel.

### 2. Study breadcrumb

Always communicate:
`Course → Specialty → Lecture/Overview`

It is orientation, not a duplicate navigation tree.

### 3. Study toolbar

Order of importance:
1. search;
2. lecture/type/topic/priority/status filters;
3. random item;
4. reveal/hide answers.

Desktop: compact sticky row/grid.
Mobile: search remains visible; remaining controls live in the existing bottom sheet.

### 4. Progress overview

Raw counts are compact metrics.
Core and overall progress receive stronger visual weight and semantic `progressbar` roles.

### 5. Navigation

Desktop:
- Lectures sidebar;
- Subtopics sidebar;
- study content.

Compact widths:
- sidebars default hidden;
- learner opens them only when needed.

### 6. Lecture content

Maximum reading width: ~1080px container, with prose constrained further to ~70–75ch.

Lecture header order:
- lecture number + specialty;
- title;
- summary;
- source note;
- counts;
- quick views/offline action.

### 7. Study cards

All card families must share:
- same radius tier;
- same low elevation tier;
- semantic metadata pills;
- 44px+ primary interactive controls;
- stable hover/pressed states;
- visible revision status.

### 8. Empty/loading/error states

Every blocked state must explain both:
- what happened;
- what the learner can do next.

Examples:
- Empty filters → **Reset filters**
- Lecture fetch → delayed skeleton, not immediate flashing spinner
- Offline quota → explain storage issue and recovery path

### 9. Print Center

Treat as a separate modal product surface:
- semantic dialog;
- focus trap + Escape;
- 44px close target;
- modes shown as selectable cards;
- sticky action footer;
- mobile becomes a bottom-sheet style dialog.

## Responsive model

### ≥1320
Full study workspace with two sidebars and bounded main reading column.

### 981–1319
Narrower navigation columns, same information architecture.

### 701–980
Sidebars default hidden; content remains primary.

### ≤700
- compact hero;
- search + Filters trigger;
- filter bottom sheet;
- two-column metric cards;
- progress cards full width;
- single-column study cards;
- safe-area aware fixed/floating controls.

### ≤390
Tighter utility layout while maintaining 44px interaction targets and no horizontal overflow.

## Interaction rules

- Touch/click targets: target 44px minimum for primary controls.
- Icons: inline SVG, consistent outline stroke language.
- Do not use emoji as structural icons.
- Do not rely on hover.
- Press feedback must not change layout geometry.
- Reduced motion disables non-essential smooth scrolling/animation.
- Focus must remain visible and unobscured.
- Disabled controls must look disabled and be semantically disabled.

## Accessibility release checks

Required:
- associated labels for form controls;
- logical heading hierarchy;
- skip-to-content;
- keyboard-operable Rapid Recall;
- dialog focus trapping;
- ARIA state for expanded/pressed/progress states;
- no color-only status meaning;
- light and dark contrast verification;
- no horizontal overflow at phone widths;
- phone landscape operability.

## Adding new UI

Before creating a new component, check whether an existing:
- button,
- card,
- pill,
- status,
- filter,
- modal,
- sidebar,
- empty state

already solves the problem. Reuse before adding another visual language.

## V2 refined presentation contract

The owner-provided production screenshots demonstrated that prolonged case revision needs **less vertical setup UI and more reading area**, not a feature-grid landing page.

- Header: restrained 18px-scale internal padding, a bounded study identity and compact course/specialty controls. Keep installation, backups, online status and appearance reachable.
- Progress: one-line semantic summary with an optional expanded metrics grid. Do not discard existing raw counts or change the meaning of rated progress.
- Navigation: keep the original independent lecture/subtopic controls; reduce their default width and maintain responsive collapse.
- Focus: optional persistent `medicalBankFocusModeV1` class on the app root. Hide secondary navigation/hero/stats while preserving breadcrumb, search, lecture filter, question content and an obvious Exit action. Must never mutate medical or progress data.
- Quick study modes: Cases, Short Questions and Images link to the corresponding existing filter states. All content remains accessible.
- Content density: light borders before heavy shadows, visibly separate scenario, numbered questions, model answer and progress actions; readable Arabic/English lines.
- Touch targets remain at least 44px for primary actions; avoid icon-only navigation without accessible labels.
- Accessibility and performance remain the merge gate, while subjective visual sign-off requires the actual V2 rendered candidate at small/mobile/desktop widths.

