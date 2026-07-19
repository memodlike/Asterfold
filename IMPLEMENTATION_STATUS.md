# Implementation status

Updated 17 July 2026. Version 1.0.0, database schema 2.

| Area | Status | Evidence |
| --- | --- | --- |
| Manifest/build foundation | Complete | WXT MV3 configuration, strict TypeScript, pinned lockfile, production output and release validator. |
| Local data model | Complete | Dexie Pages → Boards → Bookmarks, settings, wallpapers, snapshots, diagnostics, outbox, sync state; schema-1 upgrade fixture. |
| New-tab workspace | Complete | Page navigation, board canvas, bookmark cards, empty/onboarding states, responsive layout. |
| Entity operations | Complete | Create, edit, duplicate, move, reorder, collapse, soft-delete, restore, permanent-delete, and bulk bookmark actions. |
| Drag-and-drop | Complete | Pointer/keyboard sensors, persistent fractional positions, intra/cross-board moves, explicit move-dialog alternative. |
| Quick Save | Complete | Popup destination selection/new Board, current-tab capture, last/default destination, ask/instant shortcut, context menu, badge feedback. |
| Search | Complete | MiniSearch title/URL/hostname/description index, global/Page/Board scopes, exact/prefix/fuzzy behavior, keyboard palette, reveal/open/copy. |
| Import/export | Complete | Versioned JSON merge/replace, HTML import/export, Markdown export, optional Chrome import, preview, duplicate strategy, error count, snapshots. |
| Trash and privacy | Complete | Cascade semantics, undo, retention alarm/purge, permanent deletion, title/URL/search masking, optional persistence indicator. |
| Appearance | Complete | Six presets, custom live controls, reset/save/import custom theme, four WebP wallpapers, validated upload Blob, position/zoom/blur/dim/saturation. |
| Security/privacy | Complete | URL/import/theme/message validation, sender check, CSP, no remote code, least privilege, no wildcard host, threat model, clean dependency audit. |
| Tests/QA | Complete | 25 unit/integration tests plus three serial Chromium extension E2E scenarios and visual screenshots. |
| Optional cloud adapter | Implemented, disabled | Real PKCE client, RLS SQL, outbox/push/pull/retry/conflict protocol, tests, exact-origin build config. Live credentials were not supplied. |
| Public sharing | Not in local release | Sharing requires a deployed authorization/token service and is outside the credential-free personal local build; no fake UI is shipped. |
| Release | Complete | Installable folder, source/unpacked ZIPs, SHA-256 checksums, installation/privacy/permission/release documentation. |

The local release contains no required TODO, placeholder API, demo-only result, or dependency on cloud availability.
