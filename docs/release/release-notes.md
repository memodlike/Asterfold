# Asterfold 2.2.3 — Chrome Web Store readiness

Asterfold 2.2.3 is a compatibility-preserving patch release focused on data integrity, privacy consistency, and final Chrome Web Store submission readiness. The Pages → Boards → Bookmarks model and visual identity remain unchanged.

## Fixed

- Quick Save clears an invalid Board when the user selects a Page with no Boards and revalidates the Page/Board pair immediately before writing.
- Session Privacy Mode is shared between New Tab and popup through `chrome.storage.session` and is cleared automatically with the Chrome session.
- Scoped Page, Board, and selection backups can only be merged; destructive Replace is accepted only for a complete full backup.
- Full backups require consistent global settings and theme data, and restore recalculates URL-derived fields from the authoritative bookmark URL.
- JSON, HTML, and Chrome-bookmark imports have bounded depth, node, and bookmark counts; off-thread parsing supports cancellation and safe timeout handling.
- Netscape HTML descriptions round-trip correctly even when the conventional optional closing `</DD>` tag is absent.
- Imported Page titles are validated before any transaction writes; external titles and descriptions are bounded to the current schema.
- Free-grid placement swaps and Board reordering commit in one Dexie transaction.
- Settings read-modify-write and uploaded-wallpaper cleanup commit atomically, preventing unrelated concurrent settings from being lost.
- Changing the default Page also assigns a Board on that Page and updates version metadata for the previous default.
- Version 2.2.3 stops creating inaccessible diagnostic snapshots. The legacy IndexedDB store remains only for non-destructive migration compatibility.
- Release validation scans additional remote Worker, SharedWorker, iframe, WASM, executable data-URL, and dynamic-code patterns.
- Real MV3 E2E tests now isolate locale state between serial scenarios.

## Permissions

Required permissions are `activeTab`, `favicon`, `alarms`, `contextMenus`, and `storage`.

`storage` is used only for the transient Privacy Mode flag in `chrome.storage.session`. Optional `bookmarks` access remains requested only from the explicit Chrome import action. Host permissions and content scripts remain absent.

## Validation completed

The release candidate passed:

- TypeScript type checking;
- ESLint with zero warnings;
- unit and integration tests with coverage gates;
- production dependency audit;
- dependency review;
- deterministic Linux and Windows release generation;
- Chrome Web Store asset validation;
- real unpacked Manifest V3 Playwright E2E tests;
- accessibility checks;
- CodeQL analysis.

Release archives include SHA-256 checksums and are generated from the tagged source commit.

## Chrome Web Store status

This GitHub Release is prepared for Chrome Web Store submission. Publication or approval by Google is not claimed until it occurs.