# Asterfold 2.2.3 — Chrome Web Store readiness

Asterfold 2.2.3 is a compatibility-preserving patch release focused on data integrity, privacy consistency and final Chrome Web Store submission readiness. The Pages → Boards → Bookmarks model and visual identity remain unchanged.

## Fixed

- Quick Save clears an invalid Board when the user selects a Page with no Boards and revalidates the Page/Board pair immediately before writing.
- Session Privacy Mode is shared between New Tab and popup through `chrome.storage.session` and is cleared automatically with the Chrome session.
- Scoped Page, Board and selection backups can only be merged; destructive Replace is accepted only for a complete full backup.
- Full backups require consistent global settings/theme data, and restore normalizes URL-derived fields from the authoritative bookmark URL.
- JSON, HTML and Chrome-bookmark imports have bounded depth, node and bookmark counts; off-thread parsing can be cancelled and times out safely.
- Netscape HTML descriptions round-trip correctly even when the conventional optional closing `</DD>` tag is absent.
- Imported Page titles are validated before any transaction writes; external titles and descriptions are bounded to the current schema.
- Free-grid placement swap and Board reordering commit in one Dexie transaction.
- Settings read-modify-write and uploaded-wallpaper cleanup commit atomically, preventing unrelated concurrent settings from being lost.
- Changing the default Page also assigns a Board on that Page and updates version metadata for the previous default.
- Version 2.2.3 stops creating inaccessible diagnostic snapshots. The legacy IndexedDB store remains only for non-destructive migration compatibility.
- Release validation scans additional remote worker, iframe, WASM and executable data-URL patterns.

## Permissions

Required permissions are `activeTab`, `favicon`, `alarms`, `contextMenus` and `storage`. `storage` is used only for the transient Privacy Mode flag in `chrome.storage.session`. Optional `bookmarks` remains requested only from the explicit Chrome import action. Host permissions and content scripts remain absent.

## Validation

The release branch must pass TypeScript, ESLint, unit/integration coverage, production dependency audit, deterministic release generation, Store asset validation, Windows packaging, CodeQL and real unpacked-MV3 Playwright tests before the release is marked ready.

Chrome Web Store submission or approval is not claimed by this repository.
