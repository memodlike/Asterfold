# Asterfold 1.0.0 final report

## Outcome

Asterfold is a complete installable local-first Chrome extension under original branding. It provides a Manifest V3 new-tab workspace, Quick Save popup/shortcut/context menus, Pages → Boards → Bookmarks, persistent ordering and cross-board drag, search, import/export, Trash, Privacy Mode, six presets, custom themes, original wallpapers, local storage, tests, and a validated production release.

Application version: `1.0.0`. IndexedDB schema: `2`. Minimum Chrome: `120`.

## Architecture

- WXT/React/strict TypeScript produces independent new-tab, popup, and MV3 service-worker entrypoints.
- Dexie IndexedDB is the immediate source of truth across tabs, popup, and worker. React observes committed records; fractional rank strings preserve order.
- MiniSearch supplies local fuzzy/prefix/exact queries. Search text never leaves the browser.
- dnd-kit supplies pointer/keyboard sortable behavior; every move also has a non-drag dialog path.
- Zod validates backups, themes, sync payloads, and runtime messages. Central URL rules guard persistence and navigation.
- Settings/Search/Trash/Editor/import are lazy boundaries; optional cloud code is compile-time disabled and dynamically loaded only when configured.

## Security and permissions

Required permissions are `activeTab`, `alarms`, `contextMenus`, `favicon`, and `storage`. `bookmarks` and `identity` are optional. The local manifest has no host permissions, content scripts, remote code, broad `tabs`, `history`, `scripting`, cookies, clipboard-read, or downloads permission. `npm audit` reports zero vulnerabilities. Details are in `PERMISSIONS.md`, `PRIVACY.md`, `THREAT_MODEL.md`, and `SECURITY_REVIEW.md`.

## Verification summary

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Unit/integration: 26/26 pass across 6 files.
- Production build: pass, 842.53 kB reported total.
- Real Chromium MV3 E2E: 3/3 pass, including persistence, real pointer drag, fuzzy search, Privacy, every theme, JSON round-trip preview, Trash, worker save, multi-tab propagation, and shared popup data.
- Performance on the final unpacked release: warm new tab median 194.1 ms, local commit 63.0 ms, popup 180.0 ms, longest task 197.0 ms; 10k query 14.81 ms and 10k import 2.74 s in the unit benchmark.
- Dependency audit: 0 known vulnerabilities.

See `QA_REPORT.md`, `PERFORMANCE_REPORT.md`, `DESIGN_FIDELITY_REPORT.md`, and `FINAL_PARITY_REPORT.md` for detailed evidence.

## Release artifacts

- Installable folder: `release/chrome-unpacked/`
- Installable ZIP: `release/chrome-unpacked.zip`
- Source ZIP: `release/extension-source.zip`
- Checksums: `release/checksums.txt`
- Installation: `release/INSTALL.md`
- Source root: this repository directory
- Visual evidence: `artifacts/screenshots/`

`scripts/release.mjs` rebuilds/copies the unpacked output, rejects forbidden permissions/wildcard hosts/maps/secret signatures, includes the release documents, creates both archives, and computes SHA-256 checksums.

## Cloud status and limitations

The shipped build is intentionally local-only and fully functional without a key. The repository includes a real optional Supabase PKCE/RLS/outbox sync implementation, SQL migration, retry/conflict tests, and setup guide. No URL/key was supplied, so live Google OAuth, two-user isolation, token revocation, cross-device replay, and a sharing service are not claimed. Public sharing is omitted rather than represented by fake controls.

Privacy Mode is visual shoulder-surfing protection, not encryption. For an unpacked extension without a published key, keep the installation directory path stable across upgrades so Chrome preserves its extension ID and local database namespace.

## Installation

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `release/chrome-unpacked`. Open a new tab, pin Asterfold for Quick Save, and optionally configure the command at `chrome://extensions/shortcuts`. Export a JSON backup before upgrades.
