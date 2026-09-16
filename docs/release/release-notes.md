# Asterfold 3.5.1

## Chrome-Owned Favicons and Refined Bookmark Motion

- **Real Favicons by Default**: Restores Chrome's browser-owned `_favicon` resource for saved, validated HTTP(S) bookmarks. Asterfold uses no third-party favicon provider, direct website request, host permission, binary icon cache, or remote favicon value from bookmark data.
- **High-DPI Resource Selection**: Favicon resources are selected from standard Chrome-friendly sizes using the rendered icon size and device pixel ratio, while the UI preserves aspect ratio with `object-fit: contain` and a stable layout box.
- **Privacy-Safe Fallback**: Missing or failed favicons use a neutral globe icon. Privacy Mode does not construct or render the favicon resource, so it does not disclose the saved site identity.
- **Minimum Permission Surface**: Adds only the `favicon` permission beside `storage`; `bookmarks` remains optional, `host_permissions` remains empty, and `activeTab`, `alarms`, and `contextMenus` remain absent.
- **Quiet Adaptive Motion**: Moves bookmark hover motion from the dnd-kit sortable wrapper to an inner visual surface, preventing transform contention during drag. Quality and Balanced profiles use a restrained lift; Compatibility, Software, Low Power, and reduced-motion states disable spatial hover motion.

# Asterfold 3.5.0

## Advanced Multi-Point Gradient Background Customization

- **Configurable 1–10 Gradient Points**: Users can customize background gradients with 1 to 10 points, tuning color, spatial position (X/Y coordinates with quick presets for Top-Left, Top-Right, Center, Bottom-Left, Bottom-Right), radial spread, opacity, and toggle visibility per point.
- **5 Curated Starter Presets**: Built-in presets designed for visual harmony and contrast:
  - **Current**: Dynamically derives from the workspace theme's accent color.
  - **Cool**: Deep oceanic blues, teals, and cyan tones.
  - **Aurora**: Vibrant northern lights with emerald greens, purples, and amber glows.
  - **Warm**: Dusk and sunset glows featuring magenta, peach, and warm ambers.
  - **Neutral**: Subtle, refined slate and graphite tones for focused minimalist workflows.
- **Harmonic Random Gradient Generator**: One-click curated randomizer that uses color harmony algorithms (triadic, analogous, complementary) and spatial distribution anchors to create visually pleasing, non-clashing gradient layouts every time.
- **Tiered Performance Profile Compatibility**: Gradient compilation integrates seamlessly into Asterfold's multi-tier rendering architecture. Quality and Balanced profiles render full multi-layer gradients, Compatibility mode supports clean layered fallbacks, and Software mode clamps to the top 3 dominant points for maximum responsiveness on legacy GPUs.
- **Apple-Style Progressive Disclosure**: Settings Appearance UI presents a clean, non-overwhelming preset selector and quick randomizer by default, with an expandable point inspector for fine-grained coordinate and color editing.

## Smart Bookmark Name Recovery During Import

- **Human-Readable Brand Casings**: Automatically recovers clean, canonical brand casings for over 100 popular services (such as YouTube, GitHub, Google Docs, Notion, Figma, Linear, Spotify, Discord, Reddit, and more) when imported bookmark titles are missing or unusable.
- **Service Subdomain & Multi-Part TLD Handling**: Accurately recognizes subdomains (e.g., `docs.google.com` → "Google Docs", `gist.github.com` → "GitHub Gist") and multi-part public suffixes (`.co.uk`, `.com.au`, `.co.jp`, etc.) without awkward truncations.
- **100% User Title Preservation**: Strictly preserves meaningful user-assigned titles. Recovery triggers only when the title is empty, whitespace, a generic placeholder (such as "Bookmark", "Untitled", "New Tab"), or a raw URL string.
- **Zero-Network Invariant**: Operates entirely in-memory on the client device with zero network calls, zero tracking, and absolute privacy.

## Verification & Architecture

- **Full Test Suite & E2E Verification**: 54 test files (418 tests) passing across Vitest and Playwright real-MV3 unpacked browser automation suites.
- **Complete 12-Locale Localization**: All 14 new gradient customization keys fully localized across English, Russian, Kazakh, German, Spanish, French, Italian, Portuguese, Polish, Ukrainian, Turkish, and Dutch with zero untranslated English leakage.
- **Zero Privileged Permissions**: Maintained strict least-privilege manifest (`permissions: ["storage"]`, optional on-demand `bookmarks` with immediate revocation, empty `host_permissions`).

# Asterfold 3.4.1

## Comprehensive Privacy Hardening & Permission Minimization

- **Zero Privileged Permissions**: Completely removed `activeTab`, `contextMenus`, `alarms`, and `favicon` permissions from the extension manifest.
- **Strict Least-Privilege Manifest**: Retained only `permissions: ["storage"]` (used exclusively for ephemeral `chrome.storage.session` shoulder-surfing visual Privacy Mode synchronization) and user-initiated `optional_permissions: ["bookmarks"]`.
- **Zero Browsing Activity Inspection**: Asterfold does not query active tabs, does not inspect active-tab URLs or titles, and has no context menu sinks or background alarm polling loops.
- **Immediate Permission Revocation**: Chrome Bookmarks access is requested strictly on-demand when the user clicks "Import from Chrome" or "Refresh from Chrome", and is guaranteed to be revoked immediately via `browser.permissions.remove` in a `finally` block upon read completion or failure.

## Non-Destructive Idempotent Chrome Bookmark Synchronization (Database Schema 9)

- **IndexedDB Schema 9**: Upgraded Asterfold's local database to Schema 9, adding `sourceId` index to `boards` and `bookmarks` without data loss or structural alteration of existing user content.
- **Stable Source ID Mapping**: Chrome bookmark import and refresh link items via their stable Chrome node IDs (`sourceId`), enabling repeated non-destructive overlay merges without duplicating bookmarks.
- **User Customization Preservation**: Re-importing or refreshing from Chrome never overwrites local bookmark notes, custom titles, or positions, and never deletes custom user-created bookmarks or boards.

## Deterministic Local Monogram Avatars

- **Zero Remote & Extension Favicon Leakage**: Eliminated all calls to `chrome.runtime.getURL("/_favicon/...")` and external favicon endpoints.
- **Deterministic Avatars**: Bookmark cards render high-contrast, beautiful deterministic letter/monogram avatars generated directly from hostname and title strings in memory, ensuring absolute privacy and zero history leakage.

## Privacy-Neutral Extension Launcher Popup

- **Offline Workspace Dashboard**: Refactored the toolbar action popup into a privacy-neutral launcher displaying local workspace metrics (Pages, Boards, Bookmarks count), a direct "Open Asterfold" launcher, an on-demand "Refresh from Chrome" action, and a quick settings link.
- **Zero Active-Tab Queries**: The popup operates 100% locally without invoking `browser.tabs.query` or accessing any open browser tabs.

## Verification

- Verified across all quality gates: `npm run typecheck`, `npm run lint`, all unit & integration test suites (`npm test`), 600-card stress benchmarks (`npm run test:stress`), source security scanner (`npm run scan:source`), store asset validation (`npm run validate:store`), Playwright real-MV3 unpacked E2E suite (`npm run test:e2e`), and bit-for-bit reproducible packaging (`npm run release:repro`).

# Asterfold 3.4.0

## Multi-tier performance profile architecture

- Introduced 6-tier rendering architecture (`auto`, `quality`, `balanced`, `compatibility`, `software`, `custom`) for seamless scalability from integrated/legacy GPUs (AMD Radeon HD/R5/R7, Intel HD Graphics, SwiftShader, Mesa) to high-refresh displays.
- Implemented live hardware detection heuristics (`classifyPerformanceMode` and `recommendPerformanceProfile`) providing plain-language, localized recommendation rationales.
- Implemented `balanced` mode with capped 10px blur, static wallpaper transforms, and single-layer subtle shadows; `compatibility` and `software` modes maintain 0px blur and opaque surfaces.

## Modernized Settings UX & zero-data-loss controls

- Added segmented performance profile selector and real-time hardware recommendation banner in Appearance settings.
- Added "Restore Defaults" button with localized confirmation dialog (`settings.resetDefaultsConfirm`) resetting theme, layout, rows, and retention without deleting user bookmarks or boards.
- Added "Restart Welcome Tour" action in Data & Privacy allowing users to safely re-experience the onboarding wizard without data loss.

## Zero-leakage localization across 12 locales

- Modularized translations into dedicated per-language dictionaries under `src/i18n/locales/` (`ru`, `kk`, `en`, `es`, `de`, `fr`, `it`, `pt`, `pl`, `uk`, `tr`, `nl`).
- Expanded dictionary to 275 keys per language with 100% placeholder parity, zero missing keys, and zero English leakage in non-English interfaces.
- Fully localized onboarding messages across all 12 languages.

## E2E test runner modernization

- Updated Playwright test runners to use Chrome for Testing with `--headless=new`, ensuring reliable MV3 service worker lifecycle event delivery in headless environments.

## Verification

- Gated by version consistency, dependency audits, source security scans, TypeScript strict checks (`npm run typecheck`), ESLint (`npm run lint`), all 51 unit & integration test suites (387 tests), 600-bookmark stress testing (`npm run test:stress`), Playwright MV3 E2E test suites (`npm run test:e2e`), store asset validation, and deterministic reproducible ZIP packaging (`npm run release:repro`).

## Previous release details

# Asterfold 3.3.0

## Interface clarity and accessibility

- Redesigned Settings navigation as keyboard-operable semantic tabs, with one predictable content scroll region and progressive Appearance controls.
- Reduced first-run setup to Welcome, Import and Appearance while retaining local, preview-first and atomic import behavior.
- Unified Quick Save with the shared semantic color system, improved constrained-height behavior and announced save/error feedback to assistive technology.
- Bounded search input and preserved the existing local-first, zero-telemetry and least-privilege MV3 model.

## Verification

- Validated with version consistency, source security scan, TypeScript, ESLint, unit/integration tests, production build, Store asset validation, production dependency audit and deterministic release reproducibility checks.

## Previous release details

# Asterfold 3.2.3

## Chrome Web Store privacy practices & zero-history disclosure correction

- Corrected Chrome Web Store developer declarations: confirmed that Asterfold does not collect web browsing history, website content, or user data. Asterfold is a 100% local-first visual bookmark workspace; user bookmarks are stored exclusively on-device in IndexedDB.
- Hardened Chrome bookmark import in Settings: unified Chrome bookmark extraction with `readChromeBookmarks(true)`, guaranteeing that the optional `bookmarks` permission is requested on-demand only during reading and immediately revoked via `browser.permissions.remove`, preventing persistent permission warnings in Chrome settings.
- Updated store documentation, submission checklists, and privacy statements to clarify that user-curated local bookmarks are not web history.

## Runtime

- No new permissions, no host permissions.
- Strictly zero-telemetry, zero remote scripts, zero dynamic code.
- Immediate revocation of optional `bookmarks` permission post-import.

## Verification

- Gated by version consistency, dependency audits, source security scans, TypeScript strict checks, ESLint, unit/integration test suites (382 tests), store asset validation, deterministic package verification, and reproducible ZIP generation.

# Asterfold 3.2.2

## Design-system hardening

- Unified Quick Save with Light/Dark/System semantic theme tokens and the active accent while keeping opaque, weak-PC-safe surfaces.
- Corrected startup theme and Motion Off behavior, blocking-overlay orchestration, lazy overlay feedback, bookmark reveal, and toast timing.
- Added container-aware Board columns, responsive hit areas, mobile Board sizing, Settings scrolling, and performance-mode affordance fixes.
- Added regression coverage for startup motion, overlay invariants, Board column behavior, and toast lifecycle.
- Pinned the patched Nano ID 3.3.17 upstream commit in the development toolchain; runtime permissions and local-first behavior are unchanged.

## Verification

- Release remains gated by version consistency, dependency audits, source scan, typecheck, lint, coverage, Store validation, reproducible Linux/Windows packaging, real MV3/accessibility E2E, compatibility stress testing, exact 2.2.3 upgrade E2E and CodeQL.

# Asterfold 3.2.1

## Store listing

- Updated the Chrome extension name to `Asterfold — Visual Bookmark Workspace` while keeping `short_name` as `Asterfold`.
- Refined English and Russian Chrome Web Store copy around the actual New Tab visual bookmark workspace use case.
- Replaced stale `Balanced` terminology with the current rendering labels and synchronized the Store category to `Workflow & Planning`.
- Synchronized submission values, checklist, README and privacy-policy version metadata for 3.2.1.

## Runtime

- No new permissions or host permissions.
- No change to Asterfold's core bookmark-workspace functionality.
- No change to local-first storage behavior, backend/network behavior or optional Chrome bookmark import model.

## Verification

- Release remains gated by version consistency, dependency audits, source scan, typecheck, lint, coverage, Store validation, reproducible Linux/Windows packaging, real MV3 E2E, stress testing, exact 2.2.3 upgrade E2E and CodeQL.

## Previous release details

# Asterfold 3.2.0

## Guided first-run setup

- Opens a localized four-step setup only for genuinely fresh installations.
- Lets users choose the interface language, import source, initial appearance and final review before any workspace write.
- Supports Chrome bookmarks, browser-exported HTML and validated Asterfold JSON backups.
- Keeps import parsing and preview local, abortable and off the main UI path.

## Safe upgrades and recovery

- Migrates every existing Asterfold database to schema 8 with onboarding already completed, so updates never display the blocking wizard.
- Requests the optional Chrome bookmarks permission only after an explicit user action and removes it after reading.
- Commits onboarding once, validates workspace invariants and restores a recovery backup on failure.
- Requires explicit confirmation before skipping guided setup.

## Appearance and accessibility

- Previews theme, mode, density, rows and bundled wallpaper choices without persisting them before Finish.
- Uses an opaque responsive dialog, trapped keyboard focus, reduced-motion support and localized accessible names.
- Preserves the existing flash-free startup path and weak-GPU compatibility mode.

## Verification

- Adds unit and integration coverage for onboarding state, migration, localization, Chrome permission handling, rollback and idempotency.
- Adds real unpacked-MV3 E2E coverage proving fresh-profile completion and non-reappearance.
- Retains strict typecheck, lint, coverage, security, CodeQL, deterministic Linux/Windows packaging, accessibility, Windows stress and exact 2.2.3 upgrade gates.

## Previous release details

# Asterfold 3.1.4

## Opaque, readable interface surfaces

- Makes Settings, editors, search, move dialogs, Quick Save and every dropdown surface fully opaque in both light and dark themes.
- Prevents wallpaper and workspace content from bleeding through menus, forms and popovers.
- Uses theme-aware borders, focus rings and shadows without GPU-heavy live backdrop filters.

## Custom adaptive dropdowns and locale flags

- Replaces visible native selects with one accessible Asterfold listbox system across the extension.
- Supports pointer input, Arrow keys, Home, End, Enter, Space, Escape, Tab and typeahead search.
- Positions menus above or below according to the available viewport and keeps them inside the screen.
- Replaces text country codes with local SVG flags that render consistently on Windows, macOS and Linux.

## Reliable Appearance controls

- Applies theme, background, glass, opacity, blur, dimming, wallpaper blur and saturation changes immediately.
- Persists rapid slider input with a short debounce instead of writing IndexedDB on every pointer frame.
- Flushes pending settings safely when Settings closes and preserves uploaded-wallpaper metadata.

## Weak-PC and Windows 11 optimization

- Preserves the Radeon R5 230/Caicos compatibility path and avoids classifying missing WebGL as software rendering.
- Uses compatibility-safe opaque controls, compositor-safe motion and no live backdrop blur in constrained modes.
- Keeps reduced-transparency and reduced-motion preferences authoritative.

## Verification

- Adds dedicated custom-select coverage for pointer, keyboard, typeahead, disabled states, adaptive placement and outside-click behavior.
- Retains strict global coverage thresholds instead of lowering them.
- Retains security scans, dependency review, CodeQL, deterministic Linux/Windows packaging, Store validation, real MV3 accessibility/visual E2E, Windows stress and exact 2.2.3 upgrade gates.

## Previous release details

## 3.1.3 — Flash-free new-tab startup

## Flash-free new-tab startup

- Paints a dark critical surface before React and the main stylesheet load.
- Restores a strictly validated local visual snapshot for the canvas and bundled wallpaper.
- Keeps React hidden until IndexedDB, the selected theme and wallpaper resolve, then reveals the final workspace once.
- Applies final theme variables before the first visible React frame and keeps a five-second failure fallback.

## Entrance motion

- Fades the final wallpaper without animating blur or filters.
- Introduces a restrained board stagger and launcher rise using opacity and transform only.
- Runs only during initial startup and respects both reduced-motion and the Asterfold motion preference.

## Verification

- Adds unit/static coverage for snapshot validation, denied storage, critical resource ordering and reduced-motion behavior.
- Adds a real unpacked-MV3 frame-sampled regression for white flashes, visible loading frames and opacity reversals.
- Retains audit, source scan, typecheck, lint, coverage, Store validation, deterministic packaging, MV3 E2E, stress and exact upgrade checks.

## Previous release details

## 3.1.2 — Original-quality uploaded wallpapers

## Original-quality uploaded wallpapers

- Stores the exact user-selected raster file without resizing, recompression or format conversion.
- Preserves the original pixel dimensions, MIME type and byte-for-byte image payload.
- Uses the original asset in Quality and Compatibility Glass, including the Radeon R5 230 path.
- Generates a separate high-quality WebP fallback capped at a 1920-pixel long edge only for software rendering.
- Accepts Chrome-decodable JPG/JPEG/JFIF, PNG, WebP, AVIF, GIF, BMP and ICO files using content-signature validation instead of unreliable operating-system MIME labels.
- Raises safe local limits to 64 MiB per original image, 16,384 pixels per side and 120 megapixels.

## Backup compatibility

- Backup format 4 preserves the original uploaded raster format and exact source bytes.
- Restore validates the original signature, dimensions, byte count and separate WebP compatibility asset.
- Backup formats 1–3 remain readable; version 3 WebP wallpaper backups continue to restore.
- File import capacity is raised to 128 MiB for backups containing a large original wallpaper.

## Verification

- Adds unit coverage for JPG, PNG, WebP, AVIF, GIF, BMP and ICO signatures.
- Verifies that a 7680×4320 source remains byte-identical while only its software fallback is resized.
- Adds real unpacked-MV3 E2E coverage for a 3840×2160 upload, IndexedDB source-size equality and renderer-specific CSS asset selection.
- Retains typecheck, lint, coverage, Store validation, deterministic Linux/Windows packaging, CodeQL, 600-card stress and exact 2.2.3 upgrade gates.

## Compatibility note

Wallpapers uploaded by 3.1.0 or 3.1.1 were already converted before storage, so their discarded original pixels cannot be reconstructed automatically. Re-upload the original file once in 3.1.2 to recover full source quality.


## Previous releases

- **3.1.1 — Wallpaper, Settings and import polish:** licensed 4K built-in wallpapers, opaque Settings, language flags and immediate navigation to imported Pages.
- **3.1.0 — Windows 11 adaptive performance:** Radeon R5 230/Caicos detection, Compatibility Glass, compositor-safe motion and 600-bookmark stress gates.
- **3.0.1 — Verified release pipeline:** exact-SHA tag gating, deterministic Linux/Windows packaging, SBOM, provenance and attestations.
- **3.0.0** was an internal release candidate and was superseded by 3.0.1 before publication.
