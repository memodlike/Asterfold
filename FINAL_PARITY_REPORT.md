# Final functional parity report

Version 1.0.0, schema 2. `PASS` means present and verified in the credential-free local release; `N/A` means an optional deployed-cloud capability is intentionally not shipped rather than simulated. There are no `FAIL` items.

## Core

| Requirement | Result | Evidence |
| --- | --- | --- |
| Manifest V3 / new-tab override / popup / service worker | PASS | Built manifest and live unpacked-worker E2E |
| Shortcut / context menu | PASS | Registered command with resolved binding; worker handlers and idempotent menus |
| Offline / no account required | PASS | Default manifest has no hosts; all core records/features local |

## Structure

| Requirement | Result | Evidence |
| --- | --- | --- |
| Pages / Boards / Bookmarks | PASS | Full hierarchy CRUD and persistence |
| Reorder all levels / persistent order | PASS | Fractional ranks and explicit controls/drag; reload assertion |
| Cross-Board move / Board-to-Page move | PASS | Pointer DnD and accessible move dialogs |
| Duplicate entities | PASS | Page, Board, bookmark duplication with new identity |

## Bookmark actions

| Requirement | Result | Evidence |
| --- | --- | --- |
| Create/edit/open | PASS | Editor and validated open modes |
| New tab/window/incognito | PASS | Narrow browser API calls after URL validation |
| Copy URL/Markdown | PASS | Explicit clipboard writes; blocked under Privacy Mode |
| Move/delete/restore | PASS | Menu/dialog/drag, transactional Trash |
| Multi-select/bulk | PASS | Modifier/shift selection, move/export/delete |
| Duplicate warning | PASS | Normalized same-Board lookup and allow-copy choice |
| Favicon fallback | PASS | Chrome `_favicon` plus icon/initial fallback |

## Quick Save

| Requirement | Result |
| --- | --- |
| Active title/URL and destination | PASS |
| Last/default destination and Create Board | PASS |
| Keyboard save / instant mode / actual registered shortcut | PASS |
| Confirmation | PASS — popup status or action badge |

## Search

| Requirement | Result |
| --- | --- |
| Global/Page/Board scopes | PASS |
| Fuzzy/prefix/exact | PASS |
| Title/URL/hostname/description/Page/Board data | PASS |
| Keyboard palette / reveal / actions | PASS |
| 10k benchmark | PASS — 14.81 ms recorded query |

## Import/export

| Requirement | Result |
| --- | --- |
| Optional bookmarks permission | PASS |
| Preview/mapping/duplicates/error summary | PASS |
| JSON export/merge/replace restore | PASS |
| Netscape HTML import/export / Markdown | PASS |
| Snapshot before destructive action | PASS |
| Round-trip / corrupt input / 10k import | PASS |

## Trash/privacy

| Requirement | Result |
| --- | --- |
| Soft delete all entities / cascade restore | PASS |
| Undo / permanent delete | PASS |
| Configurable retention/purge | PASS |
| Privacy titles/URLs/descriptions/search | PASS |
| Persistent indicator / persistence policy | PASS |
| Export remains accessible | PASS |

## Appearance

| Requirement | Result |
| --- | --- |
| System/light/dark and six presets | PASS |
| Accent/canvas/density/card/radius/blur/opacity/font/favicon controls | PASS |
| Original wallpaper upload/position/zoom/blur/dim/saturation | PASS |
| Custom theme reset/save/import and validation | PASS |
| Reduced motion / live preview / contrast warning | PASS |

## Reliability/security

| Requirement | Result |
| --- | --- |
| Reload/restart persistence / multi-tab | PASS |
| Migration tests / corrupt input | PASS |
| Snapshot before replace / no wipe on migration failure | PASS |
| Minimal permissions / no wildcard hosts | PASS |
| CSP / no remote code / no secrets | PASS |
| URL/import/message validation | PASS |
| Threat model and clean audit | PASS |

## Optional cloud

| Requirement | Result | Note |
| --- | --- | --- |
| Safe disabled mode | PASS | Shipping configuration |
| Auth/RLS | PASS (implementation) | PKCE client and forced owner RLS migration; live provider pending owner credentials |
| Outbox/push/pull/retry | PASS (implementation) | Real adapter and protocol tests |
| Offline/conflicts/tombstones | PASS (implementation) | Durable local state and monotonic protocol |
| Two-user isolation | N/A (live) | Cannot execute without a deployed owner project; SQL prevents cross-user access by construction |
| Page/Board share | N/A | Deliberately absent from local release |
| Revoke/expiration/read-only sharing | N/A | Requires the omitted deployed sharing service |

## Quality/release

| Requirement | Result |
| --- | --- |
| Typecheck/lint/unit/integration tests | PASS — 26/26 |
| Real extension E2E | PASS — 3/3 |
| Visual QA / all presets / responsive | PASS |
| Accessibility | PASS — labels, focus trap, keyboard palette, drag alternatives, reduced motion, high contrast |
| Performance report | PASS |
| Production build / Load unpacked | PASS |
| Install/permissions/privacy/release guides | PASS |
