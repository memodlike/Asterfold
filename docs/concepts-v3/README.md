# Asterfold floating-block theme directions

Generated from `reference-current-ui.png` on 19 July 2026.

## Shared anatomy

- One full-screen background coordinated with the active Chrome light or dark
  theme.
- Eight to ten independent category blocks that visibly float above the
  background and can be repositioned.
- Configurable group alignment: left, center, or right.
- Apple-like block corners, restrained borders, and shallow elevation.
- Dense vertical bookmark rows: minimalist favicon followed by bookmark title.
- Roughly 100–140 visible bookmarks in the first viewport.
- No page scrolling or nested block scrolling.
- One standalone main-screen control: Settings.

## Theme files

1. `01-obsidian-meadow.png`
2. `02-alpine-frost.png`
3. `03-midnight-cobalt.png`
4. `04-warm-ceramic.png`
5. `05-plum-aurora.png`
6. `06-titanium-studio.png`

## Implementation implications

- Category blocks require stored per-board coordinates and dimensions, plus a
  deterministic collision-free default layout.
- A global alignment preference can translate the complete block group without
  changing relative block positions.
- Two-column lists are allowed inside wider blocks while each bookmark remains
  a vertical icon-plus-title row.
- Density must derive row height and typography from viewport size and total
  visible bookmark count rather than introducing an inner scrollbar.
