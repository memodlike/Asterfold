# Design fidelity report

Review date: 17 July 2026. Viewports captured automatically from the real unpacked extension: 1440×960 for all presets, 1920×1080 desktop, 760×900 narrow, and 420×760 popup.

## Evidence

- Directional concepts: `docs/concepts/01-clean-light.png` through `04-secondary-screens.png`.
- Implemented theme captures: `artifacts/screenshots/theme-frost-light.png`, `theme-graphite-dark.png`, `theme-midnight.png`, `theme-aurora.png`, `theme-warm-paper.png`, and `theme-high-contrast.png`.
- Responsive captures: `newtab-graphite.png`, `newtab-graphite-1920.png`, and `newtab-graphite-narrow.png`.
- Popup capture: `artifacts/screenshots/popup.png`.

## Concept-to-product comparison

| Area | Concept intent | Implemented result | Status |
| --- | --- | --- | --- |
| Information hierarchy | Pages → horizontal Boards → compact bookmarks | Same hierarchy, persistent counts/order, empty drop area and add affordances | Match |
| Desktop shell | Quiet sidebar, top command bar, utility actions | Responsive expanded/rail sidebar, command palette trigger, Add/Privacy/theme/Trash/Settings | Match |
| Material | Subtle translucent surfaces, restrained borders | Semantic surface opacity/blur/radius controls; High Contrast removes glass | Match |
| Bookmark scan | Favicon, title, host, one-line description, secondary menu | Three card variants, optional metadata, safe favicon fallback, menu and drag handle | Match |
| Privacy | Immediate visible protection state | Masks titles/URL/description, disables search results/copy, persistent banner/control | Match |
| Themes | Meaningfully different light/dark/paper/aurora modes | Six token-complete presets and live custom editor | Match |
| Wallpaper | Calm, original, content-safe imagery | Four optimized 1600×1000 WebP assets plus upload/position/zoom/blur/dim/saturation | Match |
| Secondary surfaces | Small Quick Save; comprehensive Settings/Trash/Search | Separate popup bundle and lazy full-screen/side dialogs | Match |
| Responsive behavior | Desktop-first but usable narrow | Rail navigation and horizontally scrollable board canvas at 760px; no clipped critical action | Match |

## Visual defects found and fixed

1. Graphite inherited an incorrect black text color at the shell level. `color: var(--color-text)` was applied to the app shell and a browser assertion now checks the computed board-title color.
2. Wallpaper dimming applied even when no wallpaper existed, muting Frost Light and Warm Paper. The overlay now resolves to zero without a wallpaper; regenerated screenshots verify the intended canvas colors.
3. Theme screenshots accumulated action toasts, obscuring comparison. Visual QA now dismisses transient notifications before capture.
4. Built-in CSS gradients were replaced by original optimized WebP artwork, retaining an offline bundle under 100 KB for all four backgrounds.

## Intentional deviations

- Concept images contain a richer demonstration dataset; the tested product screenshots preserve the actual small user-created dataset to validate honest empty/sparse states.
- The narrow layout keeps Boards horizontally scrollable because collapsing a spatial board workspace into one vertical feed would erase its information model.
- The popup screenshot is opened against a Chrome internal test tab, so it intentionally shows the unsupported-page safety state.
- No automatic website screenshots are fetched; the Visual card variant uses typography, spacing, and favicon scale to avoid extra permissions, tracking, and network load.

## Final assessment

The implemented interface preserves the selected concepts' hierarchy, density, material, theme differentiation, and product character while remaining original. All captured presets have legible primary/secondary text, visible controls and focus styling, and consistent component geometry.
