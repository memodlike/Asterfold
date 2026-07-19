# Design research

## Product posture

Asterfold is a calm desktop workspace, not a decorative start page. The design prioritizes scan speed, explicit hierarchy, low visual noise, keyboard access, and user-controlled density. It uses familiar productivity patterns—sidebar, command bar, columns, dialogs—without reproducing another product's exact composition or assets.

## Explored directions

| Direction | Artifact | Useful qualities | Rejected/changed qualities |
| --- | --- | --- | --- |
| Clean light workspace | `docs/concepts/01-clean-light.png` | Clear hierarchy, roomy toolbar, restrained card chrome | Reduced illustration and sample-data density for a genuine empty/personal state |
| Graphite command focus | `docs/concepts/02-graphite-search.png` | Strong search priority, dark readability, compact navigation | Search overlay made functional/keyboard-first rather than permanently decorative |
| Aurora privacy | `docs/concepts/03-aurora-privacy.png` | Rich but calm wallpaper, visible protection state | Wallpaper contrast/dim controls added so content remains readable |
| Secondary screens | `docs/concepts/04-secondary-screens.png` | Cohesive popup/settings/Trash vocabulary | Converted static composition into separate, focused responsive surfaces |

## Chosen system

- Original eight-point folding-star mark and Asterfold wordmark.
- System sans typography with 11–16px working sizes and clear weight hierarchy.
- Semantic colors and translucent surfaces; no component-owned theme palette.
- 8px-derived spacing, 10–14px default radii, subtle 1px borders, shallow elevation.
- Lucide outline icons with labels/tooltips on icon-only actions.
- Board columns read as open workspace lanes rather than stacked nested cards.
- Motion is short transform/opacity feedback and is removed under `prefers-reduced-motion` or the user toggle.
- Six complete presets plus bounded user customization and portable custom-theme JSON.
- Four original generated WebP wallpapers; no remote or reference-product artwork.

## Accessibility decisions

Visible focus rings use the active accent; dialogs trap Tab and close with Escape; search is `Ctrl/Cmd+K`; every drag operation has menu/dialog alternatives; Privacy Mode is visibly persistent while active; High Contrast avoids translucency and uses hard white boundaries. User accent/canvas selection shows a contrast ratio warning.
