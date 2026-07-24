# Accessibility verification matrix

Evidence below is limited to tests executed on the audit branch. `PARTIAL` identifies a contract that still needs a later release-gate check.

| Surface | Keyboard contract | Focus contract | Semantic contract | Preferences/zoom | Status | Planned evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Launcher | Enter/Space, arrows, Escape, non-destructive pointer leave | First menu item; restore trigger | APG menu button and menuitems | Reduced motion, high contrast CSS | VERIFIED | AF-A11Y-E001 |
| Board context menu | ArrowUp/Down, Home/End, typeahead, Escape, Tab | First enabled item; restore trigger | `menu`/`menuitem`, disabled items skipped | Viewport edge assertions | VERIFIED | AF-A11Y-T001, AF-A11Y-E001 |
| Bookmark context menu | Same as board menu | Same as board menu | Neutral labels in Privacy Mode | Forced-colors CSS | VERIFIED | AF-A11Y-T001, AF-PRIV-T002 |
| Search | IME-safe Enter and Escape | Input focus; ordinary list pattern | No nested interactive `option` | NFKC/case bounds | VERIFIED | AF-A11Y-E001, AF-PERF-T002 |
| Dialogs | Tab loop, Escape, intentional down/up backdrop sequence | Fallback focus, scroll lock, stable restore | Named modal dialog | `100dvh` | VERIFIED | AF-A11Y-T001 |
| Trash filters | Native pressed buttons | Visible focus | Group with `aria-pressed` | High contrast CSS | VERIFIED | AF-A11Y-E001 |
| Toasts | Reachable action; timeout pauses on hover/focus | No focus theft | Error alert; polite status; tone icon | Reduced motion CSS | VERIFIED | Source review + AF-A11Y-E001 |
| Bookmark cards | Enter/Space/open shortcut | Visible focus | Neutral accessible name in Privacy Mode | 20 px compact row preserves 100-item fit | PARTIAL | AF-PRIV-T002; touch target tradeoff remains |
| Settings | Full native control keyboard operation | Dialog restore and scroll lock | Labels and groups | Reduced transparency CSS | PARTIAL | Dirty-close and 200% zoom remain Phase 10/15 |
| Popup | Native controls | Browser-controlled initial focus | Localized controls/status | Platform shortcut label | PARTIAL | Popup axe/200% zoom remains Phase 15 |

## Dependency decision

`@axe-core/playwright` 4.12.1 is test-only, MPL-2.0, and adds no extension bundle bytes. It was selected because the phase explicitly requires axe on the real MV3 page; a hand-written DOM heuristic cannot provide equivalent rule coverage.
