# Design system

Apple-inspired does **not** mean copying Apple branding, SF Pro licensing, Fitness+ layouts, or product icons. It means: generous space, clear hierarchy, restrained color, large primary metrics, compact secondary context, excellent typography, and one obvious action.

UI resources come **strictly** from [https://www.shadcn.io](https://www.shadcn.io). Do not treat ui.shadcn.com as the source of truth for this project. shadcn.io states it is not affiliated with official shadcn/ui; we still install from **their** registry URLs as required.

## 1. Installation (verified)

Source: [https://www.shadcn.io/ui/installation/nextjs](https://www.shadcn.io/ui/installation/nextjs)

Existing Next.js app:

```bash
npx shadcn@latest init
npx shadcn@latest add https://www.shadcn.io/r/button.json
```

Registry pattern for every primitive:

```bash
npx shadcn@latest add https://www.shadcn.io/r/{name}.json
```

Before adding a component in a later phase: open the shadcn.io page, confirm the API (exports, composition), confirm a11y/keyboard notes, and confirm it matches this document's visual rules.

## 2. Visual direction

| Token      | Direction                                                           |
| ---------- | ------------------------------------------------------------------- |
| Background | Near-white (`oklch` / zinc-50), not a gray admin canvas             |
| Surface    | White cards, 1px subtle border, **small** shadow (or none)          |
| Text       | Near-black primary, muted secondary                                 |
| Accent     | One restrained blue/ink, not rainbow, not heavy gradient            |
| Radius     | Medium (shadcn default), consistent                                 |
| Density    | Mobile-first; dashboard uses CSS grid with large metric + caption   |
| Motion     | `prefers-reduced-motion: reduce` disables non-essential transitions |
| Contrast   | WCAG AA for text; do not use low-contrast gray-on-gray for metrics  |

Avoid: generic admin dashboards, clutter, excessive gradients, heavy glassmorphism, decorative animation, unexplained scores, false precision (pace to 3 decimals).

Typography: use the font pair chosen by `shadcn init` (often Geist). If we add a premium serif for display numbers, it must be an open-licensed font (for example Source Serif or IBM Plex) — **not** San Francisco.

## 3. Layout patterns

- **Mobile:** top bar with product name + primary action; bottom navigation (overview, run, recover, log, more).
- **Desktop:** slim left nav + wide content (max ~1100px for reading, wider for charts).
- One primary button per screen (`Button` default variant). Secondary is outline/ghost.
- Empty states use [Empty](https://www.shadcn.io/ui/empty).
- Loading uses [Skeleton](https://www.shadcn.io/ui/skeleton) / [Spinner](https://www.shadcn.io/ui/spinner).
- Errors use [Alert](https://www.shadcn.io/ui/alert).

## 4. Phase 1 component allowlist

Install only what Phase 1 screens need. Verify API on the linked page at implementation time.

| Component                       | Source URL                                                                                                                                           | Use                                       | Extra deps (typical)                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Button                          | [https://www.shadcn.io/ui/button](https://www.shadcn.io/ui/button)                                                                                   | Primary/secondary actions                 | radix slot, CVA                           |
| Input                           | [https://www.shadcn.io/ui/input](https://www.shadcn.io/ui/input)                                                                                     | Email, password, names                    | —                                         |
| Label                           | [https://www.shadcn.io/ui/label](https://www.shadcn.io/ui/label)                                                                                     | Accessible labels                         | radix label                               |
| Field                           | [https://www.shadcn.io/ui/field](https://www.shadcn.io/ui/field)                                                                                     | Form layout if still matching current API | —                                         |
| Form                            | [https://www.shadcn.io/ui/form](https://www.shadcn.io/ui/form)                                                                                       | RHF + Zod                                 | `react-hook-form`, `@hookform/resolvers`  |
| Card                            | [https://www.shadcn.io/ui/card](https://www.shadcn.io/ui/card)                                                                                       | Auth and onboarding sections              | —                                         |
| Select                          | [https://www.shadcn.io/ui/select](https://www.shadcn.io/ui/select)                                                                                   | Timezone, units, race type                | radix select                              |
| Checkbox                        | [https://www.shadcn.io/ui/checkbox](https://www.shadcn.io/ui/checkbox)                                                                               | Privacy acknowledgement                   | radix checkbox                            |
| Alert                           | [https://www.shadcn.io/ui/alert](https://www.shadcn.io/ui/alert)                                                                                     | Auth errors                               | —                                         |
| Sonner                          | [https://www.shadcn.io/ui/sonner](https://www.shadcn.io/ui/sonner)                                                                                   | Save feedback                             | `sonner`                                  |
| Skeleton                        | [https://www.shadcn.io/ui/skeleton](https://www.shadcn.io/ui/skeleton)                                                                               | Loading                                   | —                                         |
| Separator                       | [https://www.shadcn.io/ui/separator](https://www.shadcn.io/ui/separator)                                                                             | Visual grouping                           | radix separator                           |
| Dropdown Menu                   | [https://www.shadcn.io/ui/dropdown-menu](https://www.shadcn.io/ui/dropdown-menu)                                                                     | Account menu                              | radix dropdown                            |
| Sheet                           | [https://www.shadcn.io/ui/sheet](https://www.shadcn.io/ui/sheet)                                                                                     | Mobile nav                                | radix dialog                              |
| Labelled calendar / Date Picker | [https://www.shadcn.io/ui/calendar](https://www.shadcn.io/ui/calendar), [https://www.shadcn.io/ui/date-picker](https://www.shadcn.io/ui/date-picker) | Race date                                 | `react-day-picker` (as specified on page) |
| Native Select                   | [https://www.shadcn.io/ui/native-select](https://www.shadcn.io/ui/native-select)                                                                     | Prefer on mobile if Select is heavy       | —                                         |

Do **not** install Sidebar, Chart, Data Table, Carousel, or AI primitives in Phase 1.

Phase 2 installed Progress, Table, Alert Dialog, and Badge from the same shadcn.io registry (hand-written to avoid overwriting Button).

Phase 3 installed Chart (recharts 3.10.1), Tabs, Tooltip, Empty, and Textarea (needed for activity notes).

Phase 4 installed Dialog, Switch, and Slider from the same shadcn.io registry (hand-written to avoid overwriting Button). Textarea was already present.

## 5. Component sources by phase

Phases 1–4 are installed. Do not add further primitives until a later phase needs them.

| Phase | Component    | URL                                                                                                      |
| ----- | ------------ | -------------------------------------------------------------------------------------------------------- |
| 2     | Progress     | [https://www.shadcn.io/ui/progress](https://www.shadcn.io/ui/progress)                                   |
| 2     | Table        | [https://www.shadcn.io/ui/table](https://www.shadcn.io/ui/table)                                         |
| 2     | Alert Dialog | [https://www.shadcn.io/ui/alert-dialog](https://www.shadcn.io/ui/alert-dialog)                           |
| 2     | Badge        | [https://www.shadcn.io/ui/badge](https://www.shadcn.io/ui/badge)                                         |
| 3     | Chart        | [https://www.shadcn.io/ui/chart](https://www.shadcn.io/ui/chart) — pulls **Recharts**; needed for trends |
| 3     | Tabs         | [https://www.shadcn.io/ui/tabs](https://www.shadcn.io/ui/tabs)                                           |
| 3     | Tooltip      | [https://www.shadcn.io/ui/tooltip](https://www.shadcn.io/ui/tooltip)                                     |
| 3     | Empty        | [https://www.shadcn.io/ui/empty](https://www.shadcn.io/ui/empty)                                         |
| 4     | Textarea     | [https://www.shadcn.io/ui/textarea](https://www.shadcn.io/ui/textarea)                                   |
| 4     | Dialog       | [https://www.shadcn.io/ui/dialog](https://www.shadcn.io/ui/dialog)                                       |
| 4     | Switch       | [https://www.shadcn.io/ui/switch](https://www.shadcn.io/ui/switch)                                       |
| 4     | Slider       | [https://www.shadcn.io/ui/slider](https://www.shadcn.io/ui/slider) for RPE if it fits                    |

`/components` gallery extras (dock, marquee, credit card) are **out of scope**. Use `/ui` primitives only.

## 6. Accessibility checklist (every screen)

- Keyboard: all interactive controls reachable; Select/Dialog trap as provided by the primitive
- Visible focus rings (do not remove `outline` without a replacement)
- Labels associated with inputs
- Errors announced (Alert / `aria-live` where needed)
- Contrast AA
- Reduced motion
- Touch targets ≥ 44px on mobile primary actions

## 7. Content rules

- Swedish UI
- Metrics: large number + unit + short caption
- Secondary: smaller, muted
- Disclaimer near recommendations and AI estimates
- Sample/demo data must be labelled “Exempeldata”

## 8. Dark mode

MVP default: **light only**. If `shadcn init` injects a theme toggle, remove or hide it until a later phase. Do not ship an unfinished dark palette.
