# Medical MEQ Bank — UI Design System

## Product direction

**Style:** Clinical Study Workspace — minimal, content-first, calm, professional.

The interface is a study tool, not a marketing page. Visual hierarchy must always prioritize:
1. where the learner is;
2. what to study next;
3. progress;
4. filters/navigation;
5. secondary app/backup/offline utilities.

The system intentionally keeps the existing blue + teal identity rather than introducing a new palette during the architecture refactor.

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

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--bg` / page | `#F4F7FB` | `#0B1220` | Page background |
| `--card` / surface | `#FFFFFF` | `#111C2F` | Primary cards |
| `--text` | `#172033` | `#F8FAFC` | Primary text |
| `--muted` | `#667085` | `#ABB6C5` | Secondary text |
| `--line` | `#DBE3EE` | `#2B3A51` | Borders/dividers |
| `--brand` | `#174EA6` | lighter contextual variants | Primary action/navigation |
| `--brand2` | `#0F766E` | contextual variants | Progress/supporting state |
| Success | green semantic tokens | dark semantic pair | Mastered/saved |
| Warning | amber semantic tokens | dark semantic pair | Review/source note |
| Danger | red semantic tokens | dark semantic pair | Weak/error |

Verified primary text, muted text, brand, and revision-state foreground/background pairs meet WCAG AA contrast targets.

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

- `--shadow-sm` — study cards, sidebars, stats
- `--shadow-md` — hero / modal-level emphasis
- Do not stack multiple heavy shadows.

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
