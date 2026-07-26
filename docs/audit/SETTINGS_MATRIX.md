# Functional settings matrix

Recorded on 2026-07-24 for branch `audit/hardening-2-2`.

| Field | Persisted | Visible control | Render/behavior effect | Export | Migration | Test or decision |
|---|---|---|---|---|---|---|
| `theme.*` | Yes | Appearance | CSS theme runtime and wallpaper pipeline | Yes | v3+ | Theme and wallpaper tests |
| `layoutMode`, `boardRows`, `alignment` | Yes | Layout | Workspace packing/alignment | Yes | v3+ | E2E workspace smoke |
| `locale` | Yes | Language | New tab, popup, dialogs and title | Yes | v3+ | i18n completeness tests |
| `quickSaveDefaultPageId` | Yes | Quick Save | Popup initial destination | Yes | v3+ | Default pair invariant tests |
| `quickSaveDefaultBoardId` | Yes | Quick Save, filtered by selected page | Popup initial destination | Yes | v3+ | Default pair invariant tests |
| `privacyPersist`, `privacyEnabled` | Yes | Data & privacy / launcher | Privacy rendering and persistence | Yes | v3+ | Privacy DOM/E2E tests |
| `trashRetentionDays` | Yes | Data & privacy | Trash purge policy | Yes | v3+ | Repository tests |
| `bookmark.openMode` | Yes | Bookmark editor | Background navigation mode | Yes | v1+ | Navigation and migration tests |
| `bookmark.pinned` | Compatibility only | Hidden | Preserved without claiming ordering behavior | Yes | v1+ | Backup/migration round-trip |
| `cardVariant`, `showHostname`, `showDescription`, `faviconSize` | Compatibility only | Hidden | No user-visible claim | Yes | Legacy normalization | Backup/migration round-trip |
| `collapsed`, `board.layout`, `navigationMode`, `recentQueries` | Compatibility only | Hidden | No user-visible claim | Yes | Legacy normalization | Backup/migration round-trip |
| `quickSaveMode` | Compatibility only | Hidden | Popup always asks for destination | Yes | v3+ | Hidden until instant mode is complete |
| `duplicateStrategy` | Compatibility only | Import has an explicit local choice | Import preview only | Yes | v3+ | Import tests |

Closing Settings flushes the last debounced theme draft. The diagnostics action is deliberately named **Repeat diagnostics**; it does not claim to repair or delete data.
