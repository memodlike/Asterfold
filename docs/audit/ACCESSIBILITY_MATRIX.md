# Accessibility verification matrix

`OPEN` means the behavior has not been demonstrated on the audit branch. Existing implementation or screenshots are not treated as current evidence.

| Surface | Keyboard contract | Focus contract | Semantic contract | Preferences/zoom | Status | Planned evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Launcher | Enter/Space, Escape, non-destructive pointer leave | Entry and restore | Disclosure/navigation or complete APG menu button | Reduced motion, high contrast | OPEN | Keyboard E2E + accessibility snapshot |
| Board context menu | ArrowUp/Down, Home/End, typeahead, Escape, Tab | First enabled item; restore trigger | `menu`/`menuitem`, disabled items skipped | 200% zoom and viewport edges | OPEN | Keyboard E2E + axe + geometry assertions |
| Bookmark context menu | Same as board menu | Same as board menu | Neutral labels in Privacy Mode | Forced colors | OPEN | Privacy DOM/a11y snapshot |
| Search | IME-safe Enter and Escape | Input focus with valid active descendant | Valid combobox/listbox or ordinary list; no nested buttons in option | NFKC/case policy, 200% zoom | OPEN | axe, IME E2E, empty-result snapshot |
| Dialogs | Tab loop, Escape, intentional backdrop pointer sequence | Inert background, fallback focus, stable restore | Named dialog | `100dvh`, 200% zoom | OPEN | Keyboard E2E + scroll-lock assertion |
| Trash filters | Arrow behavior only if tabs/radios require it | Visible focus | Pressed/radio buttons or complete tabs | High contrast | OPEN | axe + accessibility snapshot |
| Toasts | Reachable action; timeout pause | No focus theft | Polite/assertive by tone with icon | Reduced motion | OPEN | Timer and live-region tests |
| Bookmark cards | Enter/Space/open shortcut | Visible focus | Neutral accessible name in Privacy Mode | Target ≥28 px; body ≥13 px | OPEN | DOM snapshot + computed-style assertions |
| Settings | Full keyboard operation | Dirty-close behavior and restore | Labels, inline errors, groups | 200% zoom; reduced transparency | OPEN | axe + keyboard E2E |
| Popup | Full keyboard operation | Deterministic initial focus | Localized controls/status | 200% zoom and platform shortcuts | OPEN | axe + popup E2E |

## Baseline limitation

`npm run test:e2e` exited before Chromium loaded the extension. No current axe, keyboard, accessibility-tree, high-contrast, reduced-motion, reduced-transparency, or 200% zoom result exists yet.
