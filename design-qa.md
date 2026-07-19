# Asterfold redesign — design QA

final result: passed

## Sources and implementation

- Composition reference: `docs/concepts-v3/01-obsidian-meadow.png`
- Material and density reference: `docs/concepts-v3/06-titanium-studio.png`
- Final workspace screenshot: `artifacts/screenshots/asterfold-redesign-final-1672x941.png`
- Final settings screenshot: `artifacts/screenshots/asterfold-settings-final-1672x941.png`
- Comparison viewport: 1672 × 941

## Full-page comparison

- Preserved the floating multi-block composition from Obsidian Meadow while removing its top navigation, rule, permanent settings button, and branded heading.
- Matched Titanium Studio's neutral charcoal canvas, thin borders, restrained radii, tight bookmark rhythm, and two-column density.
- Replaced decorative wallpaper dependence with a theme-aware neutral background; wallpaper remains an optional setting.
- Kept exactly one persistent affordance: the low-emphasis Asterfold mark at the lower-left edge.
- Four blocks containing 100 bookmarks fit the viewport without document or nested scrolling; content remains legible and evenly distributed.
- Each board is the only backdrop-filtered surface in its region; bookmark rows are flat and use only lightweight hover transforms.

## Focused state comparison

- Launcher: hover expands the mark horizontally; click reveals the vertical administration menu; outside click and Escape close it.
- Settings: the large centered glass window keeps the canvas visible as context and groups controls into five sections.
- Appearance controls provide system/light/dark, neutral/solid/wallpaper background, Regular/Clear glass, opacity, blur, and dimming without the retired noisy controls.
- RU and KK states were exercised in the same browser session; the localized document title updates immediately.

## Browser QA

- In-app Browser: launcher, Pages, Settings, RU/KK switching, wallpaper controls, and 1672 × 941 layout inspected.
- Automated unpacked Chromium: MV3 worker, bookmark creation/move/reload, block keyboard reorder, Search, Privacy, Trash restore, export v2, and 100-bookmark layouts at 1280 × 720 and 1920 × 1080.
- Console/page errors: none in the passing E2E run.
- Final 1672 × 941 metrics: 100 bookmark rows, `scrollHeight = innerHeight = 941`.

## Iteration history

1. Replaced the corrupt global stylesheet with a new semantic glass system.
2. Removed persistent chrome and rebuilt the canvas around the lower-left launcher.
3. Tuned packing and sparse-grid sizing so both few-board and 100-bookmark states remain balanced.
4. Removed board paint containment that clipped context menus.
5. Added deterministic keyboard board reordering and filtered DnD collision targets.
6. Reduced desktop canvas padding to eliminate the final two-pixel overflow at 1280 × 720.

