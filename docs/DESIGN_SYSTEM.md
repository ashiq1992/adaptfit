# AdaptFit V0.2 — Design System (Premium Pixel Hybrid)

## Reference files

The brief names `README_DESIGN_DIRECTION.md` and three images numbered 01–03. The repository's `design-references/` contains three images with different names and **no README**. They were mapped by content:

| Brief role | File in repo | Used for |
|---|---|---|
| 01 Branding master | `AdaptFit Fitness RPG Styleboard.png` | Logo, palette, Inter type, sprite style, badges, status pills |
| 02 Main UI reference | `AdaptFit Pixel Fitness Design System.png` | Home, Workout, Progress (4W/8W/12W/All), Coach, Journey layouts |
| 03 Expanded screens kit | `AdaptFit Neon Fitness UI Kit.png` | History cards, Settings rows, Journey tabs, badge set, components |

The references are artistic mockups. All artwork in the app is original (pixel adventurer drawn for this project in `src/ui/sprites.ts`; logo redrawn as SVG). No assets were extracted from the images.

## Tokens (`src/ui/tokens.css`)

| Token | Value | Use |
|---|---|---|
| Graphite | `#0F1116` | App background |
| Midnight Navy | `#131F2E` | Cards / surfaces |
| Primary Teal | `#00D6A3` | Primary actions, progress, charts, active nav |
| Reward Amber | `#F5B041` | XP, level, PRs, rewards |
| Achievement Violet | `#9B6DFF` | Rare achievements (text uses `#B897FF` for AA contrast on navy) |
| Primary text | `#F4F3EE` | |
| Secondary text | `#9CB4BB` | From the branding master (another reference shows `#9AA3AE`; the master takes priority) |
| Stat accents | STR `#FF8A5C`, END teal, REC `#5FD36B`, CONS violet | Character stats only |

Typography: **Inter** variable (bundled locally, Latin subset), tabular numbers for training data. No pixel fonts anywhere in training data, instructions, or coaching text.

## Components (`src/ui/app.css`, `controls.tsx`)

- **Cards** — midnight, 18px radius, thin border; `card-glow` (teal) for the primary action card; `card-amber` for rewards/recommendations.
- **Buttons** — primary teal (dark ink), secondary teal outline, tertiary navy, reward amber outline, danger. Minimum 44×44 px; large actions 54 px.
- **Pills** — Improved ▲ (teal), Stable — (grey), Declined ▼ (red), New (violet), PR (amber), Mission (teal outline), Completed.
- **Tabs / segmented** — teal filled selection (Overview/Exercises/…, 4W/8W/12W/All).
- **Stepper** — −/value/+ with free numeric entry for weight, reps, seconds.
- **Set rows** — 44 px check circle (one-tap confirm), set number, values with state ("From last session — not done yet" / "Done").
- **Charts** — SVG line with teal area gradient and labelled last point; planned-vs-completed bars with dashed targets. Every chart has an accessible text label listing its data.
- **Character** — 32×32 adventurer composited from layers; level unlocks: scarf (3), pack (5), cape (10), armour (15), gilded (20). Shown compact on Home/Progress, large in Journey, small on Weekly Review and completion.
- **Hex badges** — amber (common) / violet (rare) / navy (locked).

## Layout

- Mobile-first; bottom navigation Train · Progress · Coach · Journey; Settings via the gear in the header.
- ≥768 px: two-column grids.
- ≥1024 px: left sidebar navigation, wider two-column layouts with a sticky secondary column — deliberately not a stretched phone.
- Active workout is a focused screen (no nav), sticky Finish/primary action bar.
- Safe-area insets on header, nav, and action bar; `scroll-padding` keeps focused controls clear of fixed bars.

## Motion

Short progress transitions, an XP "pop", and a two-hop character celebration after a workout. No constant animation. `prefers-reduced-motion` disables animations and transitions while keeping all feedback (tested, T66).

## Visual review performed

Screens captured with Playwright at 390 px and 1280 px (plus layout checks at 375/390/430/768/1280) and compared with the references: Home, Active workout, History (collapsed and expanded), Progress, Coach (week and insights), Journey (character and achievements), Settings. Fixes made after review: Insights overload (5 plateau cards → priority-only), hidden filter panel showing, cramped "Progressing" rows, weekly-review sprite level, edit-set accessible names, bundle split.
