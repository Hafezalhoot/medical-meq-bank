# MEQ Studio — V5 World-Class Design Rebuild

**Design brief:** Replace the teal corporate/dashboard feel with a distinct, serene, premium study application. User provided actual 1535×1023 desktop screenshot of Psychiatry overview and requested world-class color, composition, sizing, layout, organization and interaction—not a minor CSS polish.

**Baseline:** main `8745ae812d971328f8da0a1f099be7d25728be18` (V4.8, 2026-10-26).  
**Working branch:** `design/v5-mineral-blue-studio-20261026`  
**Candidate:** `2026.10.26.9` — **NOT LIVE** pending source/CI checks and independent Cloudflare traffic proof.  
**Design system:** [DESIGN.md](DESIGN.md)

## Direction
- **Mood:** Mineral Blue / pearl / deep slate ink; quiet academic precision, not neon, glassmorphism or cartoon clay.
- **Palette:** `#F5F7FC` background, `#FFFFFF` surfaces, `#24304B` main text, `#4F63A8` action, `#E9EDFB` selection, `#E0E6F1` stroke; dark scheme `#121828` / `#1D2740` / `#AABBFF`.
- **Layout:** top brand/utility masthead; content-led study canvas with course/specialty + Start/Exam; restrained course/review access; calm course overview; rich but readable explanation/exam surfaces.
- **Interaction:** no lost functionality. All native course, specialty and question selectors, Weak/Review/Mastered, source images, search, Exam mode, Focus mode, Dark mode, print, backup/restore and offline remain available.
- **Image rule:** absolutely no invented or AI medical photos. Only authentic source figures already in lecture payload.

## Execution board

| ID | Priority | Status | Work | Acceptance |
| --- | --- | --- | --- | --- |
| D5-01 | P0 | DONE | User screenshot and code/state audit | Real source screenshot and deployed V4.8 repository reviewed; all preserved IDs/features listed |
| D5-02 | P0 | IN PROGRESS | New visual system and app masthead | Light/dark blue palette; separate keyboard-accessible utility bar; real course+subject buttons reachable |
| D5-03 | P0 | IN PROGRESS | New study canvas, overview & wayfinding | Disciplined typography/spacing; lecture cards and selection; Start/Exam discoverable without more clicks |
| D5-04 | P0 | IN PROGRESS | Reader and source imagery | Comfortable 74ch measure; original figures unchanged, bilingual RTL notes and MCQs legible |
| D5-05 | P0 | IN PROGRESS | Exam/print/PWA dark system | Exam and print screens use same restrained design tokens; offline install and storage unaffected |
| D5-06 | P0 | IN PROGRESS | Responsive/a11y/visual regression | Check 320/390/768/1024/1440, dark, focus, keyboard, no overflow, original source reader; pass full CI |
| D5-07 | P0 | TODO | Safe code merge & Cloudflare release verification | Exact PR SHA green: Static, Chromium, WebKit, Workers Builds; independently verified active Worker 100% |
| D5-08 | P1 | TODO | Authenticated production browser verification | Cloudflare Access service token issue #35 resolved without changing access policy |
| D5-09 | P1 | TODO | Subsequent visual audit using actual V5 screenshots | Compare source CI screenshot artifacts and owner screenshots; polish genuine breakpoints |

## Source governance & recovery

- There is **no new external font or design library** (offline PWA still works).
- Changing CSS classes/colors cannot change progress records, question IDs, answer keys, source photo SHA-256 or student data.
- On failing CI or inaccessible production Worker, do **not** claim merged/live; keep previous V4.8 production running.
- Cloudflare Access still prevents unauthenticated production browser smoke (issue #35). Build success ≠ proof of logged-in UI.
- Main auto-deployment before post-merge quality is separately tracked in issue #50. Respect safe-release dependency.
