<div align="center">
  <img src="public/icons/mark.svg" width="72" alt="Asterfold" />
  <h1>Asterfold</h1>
  <p><strong>A local-first visual bookmark workspace for the Chrome New Tab page.</strong></p>
  <p>No account · No analytics · 12 selectable interface languages · Manifest V3</p>
</div>

![Asterfold workspace](docs/images/workspace.png)

<p align="center">
  <strong>Open a new tab, find the right board, and launch the site you need.</strong><br />
  No crowded browser menus, permanent toolbars, or cloud account required.
</p>

## Overview

Asterfold replaces the Chrome New Tab page with a structured bookmark workspace:

- **Pages** separate work, study, personal, or project contexts.
- **Boards** group related bookmarks inside each Page.
- **Bookmarks** open in the current tab, a new tab, or a new window.

```text
Page: Work
├── Board: Projects
│   ├── Notion
│   ├── Linear
│   └── GitHub
└── Board: Design
    ├── Figma
    └── Mobbin
```

## Main features

| Feature | What it does |
|---|---|
| Pages and Boards | Organizes bookmarks by context and topic |
| Drag and drop | Reorders Boards and Bookmarks visually |
| Quick Save | Saves the active tab from the extension popup |
| Search | Finds bookmarks by title or URL with `Ctrl/Cmd + K` |
| Privacy Mode | Temporarily hides bookmark titles and URLs in New Tab and popup |
| Trash | Restores accidentally deleted Pages, Boards, and Bookmarks |
| Import and export | Supports Asterfold JSON backups, Netscape HTML, and optional Chrome bookmark import |
| 12 interface languages | Full English, Russian, and Kazakh coverage with safe English fallback for rare strings |
| Light and dark themes | Follows the system theme or uses a selected mode |
| Wallpaper controls | Adjusts background, surface opacity, blur, dimming, and saturation |
| Adaptive Compatibility Glass | Preserves transparency and motion on legacy Windows GPUs without live blur |

All primary data is stored locally in the Chrome profile through IndexedDB.

## Product flow

```mermaid
flowchart LR
    Chrome["Chrome New Tab"] --> Page["Page<br/>Work / Study / Personal"]
    Page --> Board1["Board<br/>Projects"]
    Page --> Board2["Board<br/>Design"]
    Page --> Board3["Board<br/>Documents"]
    Board1 --> Link1["Bookmark<br/>Notion"]
    Board1 --> Link2["Bookmark<br/>Linear"]
    Board2 --> Link3["Bookmark<br/>Figma"]
    Board3 --> Link4["Bookmark<br/>Google Docs"]
```

The editable BPMN 2.0 user-flow model is available at [docs/diagrams/asterfold-user-flow.bpmn](docs/diagrams/asterfold-user-flow.bpmn).

## Interface

Asterfold keeps the workspace visually quiet. The only permanent control is the Asterfold launcher in the lower-left corner.

The launcher provides access to:

- new Board creation;
- Page management;
- search;
- Privacy Mode;
- Trash;
- settings.

![Asterfold settings](docs/images/settings.png)

### Scale validation

| 1280 × 720 | 1920 × 1080 |
|---|---|
| ![100 bookmarks at 1280 by 720](docs/images/scale-1280x720.png) | ![100 bookmarks at 1920 by 1080](docs/images/scale-1920x1080.png) |

The release E2E suite validates 100 bookmarks across four Boards without desktop-page scrolling at 1280×720, 1672×941, and 1920×1080.

## Privacy and security

Asterfold is designed around local storage and least-privilege extension access.

- No account is required.
- No analytics or advertising SDK is included.
- No host permissions are requested.
- No content scripts are injected into websites.
- No browsing history permission is requested.
- No remote executable code is loaded.
- Backup files are created only after an explicit user action.
- Chrome bookmark access is optional and requested only from the explicit import action.

### Required permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Reads the active tab only after the user opens Quick Save |
| `favicon` | Displays Chrome-provided favicons without broad website access |
| `alarms` | Runs local maintenance and reminder tasks |
| `contextMenus` | Adds explicit Asterfold browser actions |
| `storage` | Stores only the transient cross-context Privacy Mode flag in `chrome.storage.session` |

### Optional permission

| Permission | Purpose |
|---|---|
| `bookmarks` | Imports Chrome bookmarks after direct user approval |

Detailed review material:

- [Privacy policy](docs/security/privacy.md)
- [Static privacy-policy page](docs/store/privacy.html)
- [Permission rationale](docs/security/permissions.md)
- [Chrome Web Store privacy-practice answers](docs/store/privacy-practices.md)
- [Chrome Web Store submission checklist](docs/store/submission-checklist.md)

## Install the unpacked build

1. Download and extract the latest GitHub Release.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `chrome-unpacked` folder containing `manifest.json`.
6. Open a new tab.

For normal installation, use the latest **`Asterfold-Chrome.zip`** release asset. Do not use GitHub's automatically generated source archive as an extension package.

See [docs/release/install.md](docs/release/install.md) for the full installation guide.

## Development

### Requirements

- Node.js 22 or newer
- npm
- Chromium or Google Chrome for real-extension E2E tests

### Validate the project

```bash
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
npm run release:repro
```

The project uses React 19, TypeScript, WXT, Dexie/IndexedDB, dnd-kit, MiniSearch, Vitest, Playwright, and Axe.

### Project structure

```text
entrypoints/          New Tab, popup, and service-worker entrypoints
src/app/              Workspace shell and launcher
src/features/         Boards, Bookmarks, search, settings, and Trash
src/db/               IndexedDB schema, migrations, and transactions
src/i18n/             Interface dictionaries and locale selection
tests/                Unit and integration tests
e2e/                  Real unpacked-MV3 Playwright tests
docs/                 Architecture, security, release, and review documentation
store-assets/         Chrome Web Store screenshots and promotional assets
```

Contribution guidance is available in [docs/development/CONTRIBUTING.md](docs/development/CONTRIBUTING.md).

## Release artifacts

Asterfold 3.2.0 produces a reproducible, cryptographically verifiable release containing:

- `Asterfold-Chrome.zip` — upload/install package with `manifest.json` at the ZIP root;
- `chrome-unpacked.zip` — unpacked folder wrapper;
- `extension-source.zip` — reviewable source snapshot;
- `Asterfold-Store-Assets.zip` — listing, screenshots, promo images, and review documentation;
- `checksums.txt` — SHA-256 checksums for release assets;
- `provenance.json` — source commit, tree, build-run and artifact linkage;
- `sbom.spdx.json` — SPDX 2.3 software bill of materials.

The release pipeline verifies Manifest V3 structure, permission policy, CSP, forbidden files, remote-code patterns, Store asset dimensions, Windows packaging, CodeQL, accessibility, and real unpacked-extension behavior.

## Current status

**Asterfold 3.2.0** adds a localized, migration-safe guided first-run setup with Chrome, HTML and Asterfold-backup import previews; preserves existing profiles; commits setup atomically with recovery rollback; and retains the verified opaque, accessible and weak-PC-compatible runtime.

The repository does not claim Chrome Web Store publication, approval, user counts, ratings, awards, or endorsements until those facts exist publicly.

## Version history

1. **v3.2.0 — Guided first-run setup.** Adds localized language selection, preview-only Chrome/HTML/backup imports, appearance setup, migration-safe existing-user behavior, explicit skip confirmation and recovery-backed atomic completion.
1. **v3.1.4 — Opaque settings and adaptive controls.** Makes all overlays fully opaque, introduces accessible theme-aware dropdowns with SVG flags, restores live Appearance controls, and preserves weak-GPU optimization.
2. **v3.1.3 — Flash-free new-tab startup.** Adds a critical dark first paint, validated visual snapshot, layout-timed theme application, one-time compositor-safe entrance motion, reduced-motion support, and a frame-sampled MV3 regression.
3. **v3.1.2 — Original-quality uploaded wallpapers.** Preserves uploaded raster files byte-for-byte at their original dimensions, broadens safe Chrome-decodable image support, adds backup format 4, and reserves the separate Full HD copy for software rendering only.
4. **v3.1.1 — Wallpaper, Settings and import polish.** Replaces the three built-in backgrounds with licensed 4K sources and native-size compatibility variants, makes Settings fully opaque, adds emoji flags to every language option, and opens newly imported bookmark Pages immediately at the first position.
5. **v3.1.0 — Windows 11 adaptive performance update.** Adds automatic Radeon R5 230/Caicos detection, Compatibility Glass, pre-rendered compatibility wallpaper, compositor-safe motion, Full-HD wallpaper caps, schema 7 migration, and 600-bookmark stress gates.
6. **v3.0.1 — Verified release pipeline and first-use hardening.** Adds tag-only CI-gated publishing, exact-SHA workflow checks, deterministic cross-platform packaging, SBOM/provenance/attestations, runtime-only Store ZIP validation, migration-safe launcher discovery, and versioned audit evidence.
7. **v2.2.3 — Chrome Web Store readiness.** Fixed Quick Save destination validation, cross-context session Privacy Mode, scoped restore safety, bounded imports, HTML description round-trip, atomic free-grid moves, settings races, and release gates.
8. **v2.2.2 — Data and privacy hardening.** Improved scoped backups, deleted-data merge behavior, Quick Save, atomic moves and Undo, wallpaper handling, Page actions, and background reliability.
9. **v2.2.1 — Store submission package.** Added verifiable Store collateral, privacy documentation, and backup v3 wallpaper support.
10. **v2.2.0 — Security and release hardening.** Centralized safe navigation, strengthened migrations/import/order handling, added Low Power and accessibility gates, and made release archives reproducible.
11. **v2.1.x — Localization, Search, Trash, contrast, and keyboard improvements.**
12. **v2.0.x — Pages → Boards → Bookmarks redesign and correct Chrome packaging.**

The newest published build is always listed first on the [GitHub Releases page](https://github.com/memodlike/Asterfold/releases).

> Version 3.0.0 was an internal unreleased release candidate and was superseded by 3.0.1 before publication.
