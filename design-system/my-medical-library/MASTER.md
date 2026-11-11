# My Medical Library — V6 Design System (PROPOSED)

This is a proposed **design specification**, not applied CSS. Read the [V6 information architecture spec](../../docs/superpowers/specs/2026-11-05-my-medical-library-v6-information-architecture-design.md) before implementing. Source-of-truth app remains \`src/app.css\` until reviewed feature PRs merge.

## Design thesis

**Quiet clinical reading studio:** The interface lets one medical student go from course → lecture → an explanation or question without confronting a scrolling dashboard. Preserve useful density and source evidence; don't turn the site into anonymous SaaS cards.

- Surface modes: **Operate** for Library, Practice, Review, Exams, and authoring; **Read** for Explanation and original medical figures.
- Accent: restrained dark jade/sage rather than the current blue-violet. Color does not encode grade without labels.
- Interaction: one main task per screen, one clear primary action, secondary controls in contextual panels, meaningful URL state, no default auto-expanding every content type.

## Semantic tokens (design candidates)

| Role | Light | Purpose |
|---|---|---|
| \`--color-canvas\` | \`#F6F8F7\` | Main neutral background |
| \`--color-surface\` | \`#FFFFFF\` | Reader and controls |
| \`--color-ink\` | \`#182A32\` | Main text |
| \`--color-muted\` | \`#587079\` | Supporting text (4.91:1 on canvas) |
| \`--color-border\` | \`#DCE6E4\` | Structure, not decoration |
| \`--color-primary\` | \`#1C6765\` | Main CTA (white contrast 6.61:1) |
| \`--color-primary-hover\` | \`#12504E\` | Hover and pressed |
| \`--color-selected\` | \`#E5F3F0\` | Active selection surface |
| \`--color-success\` | \`#177C61\` | Mastered / success |
| \`--color-warning\` | \`#A9640D\` | Review / warnings |
| \`--color-danger\` | \`#B42318\` | Weak / destructive |

Dark mode: derive actual contrasting semantic tokens rather than inverting raw HEX; verify all focus/disabled/hover states. Reserve blue for external links if needed.

### Typography and rhythm

- English: Inter or system sans. Arabic: Cairo with tested system fallback when a licensed, offline-safe asset is available. Do not fetch fonts from a CDN in the offline PWA.
- Text sizes: 12 / 14 / 16 / 18 / 24 / 32px; default body 16px. Reader measure 68–75ch. Mixed Arabic and English need \`dir=auto\` or isolates for abbreviations/English medical terms.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48px, used consistently. Panel radii 12px (controls) and 16px (containers); tiny/no shadows except floating navigation.
- Minimum touch targets ~44px, visible focus ring, and contrast >=4.5:1 for normal text.
- Motion under 180ms for task feedback, disabled under \`prefers-reduced-motion\`; no scroll-linked effects.

## Layout wireframes

### Desktop — Library / Subject

\`\`\`text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ My Medical Library   [Search course / lecture / topic...]      Home Library Review Exam │
├───────────────────┬──────────────────────────────────────────────────────────────────────┤
│ COURSES           │ Surgery / Urology                                                      │
│ Surgery           │ Urology                                [Find lecture...] [Sort]      │
│ Internal Medicine │ [Optional chapter groups]                                             │
│ Internal Med II   │ ┌──────────────────────────────────────────────────────────────────┐ │
│                   │ │ 01  Congenital Anomalies        0 MCQ · 12 MEQ · ...    [Open]   │ │
│ SPECIALTIES       │ │ 02  BPH & Prostate Carcinoma    ...                      [Open]   │ │
│ Urology           │ │ 03  Urological Emergencies     ...                      [Open]   │ │
│ Neurosurgery      │ └──────────────────────────────────────────────────────────────────┘ │
└───────────────────┴──────────────────────────────────────────────────────────────────────┘
\`\`\`

### Desktop — Lecture / Read

\`\`\`text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Home / Surgery / Urology / Congenital Anomalies                Previous | Next lecture   │
│ Congenital Anomalies                                                        [More ▾]     │
│ [Read] [Practice] [Original Figures] [Rapid]  only if source-authored content exists    │
├──────────────────────────────────────────────────────────────┬───────────────────────────┤
│ TOPIC 2 / 9                                                  │ THIS LECTURE              │
│ Heading                                                      │ 1. ...                    │
│ Relevant source-backed explanation or question               │ 2. ...  ◀ active          │
│ 68–75ch article measure, true figure dimensions              │ 3. ...                    │
│ Source citation and page reference                            │ Jump to a topic           │
│ [Previous topic]                        [Next topic]         │                           │
└──────────────────────────────────────────────────────────────┴───────────────────────────┘
\`\`\`

### Phone — one task per screen

\`\`\`text
┌─────────────────────────────┐
│ ‹  Urology         ⋯        │
│ Congenital Anomalies        │
│ [Read] [Practice] [Figures] │
│ Topic 2 of 9         [˅]   │
│                             │
│ Explanation heading         │
│ Actual teaching content     │
│ and source figure          │
│                             │
│ [‹ Topic] [Next topic ›]   │
├─────────────────────────────┤
│ Home | Library | Review ... │
└─────────────────────────────┘
\`\`\`

On a 390×844 phone, a selected lecture's title and its first authored content should enter the *first* viewport. Never require passing through global stats, course picker, review panel and toolbar first.

## Component inventory and states

| Component | Scope | Required states |
|---|---|---|
| App masthead and primary navigation | All | current, focus, collapsed/mobile |
| Course/subject rail | Library | selected, loading, empty, long names |
| Chapter group (optional) | Subject | expanded, collapsed, absent |
| Compact lecture row | Library/Subject | default, selected, has progress, no MCQs |
| Breadcrumb | Subject/Lecture | back, deep link, missing segment |
| Lecture mode tabs | Lecture | selected, hidden when no content, keyboard |
| Topic index / picker | Read | current, overflow, mobile sheet |
| Reading article | Lecture | headings, captions, bilingual, figures, long tables |
| Question runner | Practice | answer hidden/revealed, self-rated, exam locked |
| Search/filters | Library/Practice | scoped, empty, cleared, restored URL |
| Review queue | Review | weak, review, none, offline |
| Exam launch/session/result | Exam | draft, in-progress, resume, finished, retry |
| Import wizard / validation | Manage | duplicate, invalid, PDF source-only, approved/unapproved |
| Backup/restore and offline controls | Settings/More | preview, cancel, confirm, disconnected |
| Loading/empty/error/retry | All | explicit human-readable next action |

### Do not adopt generic card kit

Avoid uniform tall rounded cards, giant gradients, repeated icon tiles, fabricated insight numbers, or deep nested \`<details>\` as a substitute for navigation. Prefer compact lists for 8–100 lectures and spacious prose for explanation.

## Technology decision

- Existing frontend is vanilla JS/CSS/HTML with Playwright tests; **no React or Tailwind app stack**. Prefer first-party CSS variables, semantic native controls, and small local JS modules; no new runtime dependency is mandatory in phase 1.
- Design references consulted (not installed in app): [Open Props](https://open-props.style/) for semantic CSS variable conventions, [Radix Colors](https://www.radix-ui.com/colors) for accessible ramps, [Lucide](https://lucide.dev/) for optional consistent SVG icons, and [W3C ARIA APG](https://www.w3.org/WAI/ARIA/apg/) for tab/landmark/keyboard patterns.
- Installed ChatGPT design skills already used: **Impeccable, UI/UX Pro Max, Frontend Design, Web Interface Guidelines** plus **Project Autopilot**. This record is **not** a claim to have installed additional ChatGPT-web skills or npm packages.
- If a component framework is considered later, justify it against current PWA bundle size, tested accessibility, ease of progressive migration and offline behavior before adoption.

## Visual/behavior signoff

Screenshots and keyboard test at widths 320, 390, 768, 1024, 1440; Arabic+English and dark/light; 200% zoom; local storage+IndexedDB untouched; one tabpanel visible; no horizontal overflow; source figures remain original and correctly attributed. Capture before/after evidence, then perform the independent authenticated Cloudflare release smoke after controlled promotion.
