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
