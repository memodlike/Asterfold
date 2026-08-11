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

- Added localized, migration-safe guided setup for fresh installations.
- Existing profiles are migrated past onboarding and retain their existing workspace.
- Fresh setup supports preview-only Chrome bookmark import, HTML import and Asterfold backup restore before final commit.
- Setup completion is recovery-backed and commits atomically.

## Previous release details

# Asterfold 3.1.4

## Opaque settings and controls

- Settings, dialogs, menus, launcher, toasts and custom dropdowns use opaque theme-aware surfaces without live wallpaper bleed-through.
- Added accessible custom `SelectField` with keyboard navigation, typeahead, portal placement and viewport clamping.
- Replaced platform-dependent emoji flags with local inline SVG flags.
- Appearance controls preview immediately while persistence remains debounced and safe.
- Preserved compatibility/software rendering paths without reintroducing expensive live blur.

## Accessibility and interaction

- Hardened focus order and cleanup for custom select controls.
- Improved context-menu viewport clamping after late size changes.
- Preserved reduced-motion, forced-colors and high-contrast behavior.

## Release engineering

- Release assets include SBOM, provenance and checksums.
- Linux and Windows release subjects are compared byte-for-byte.
- npm toolchain is pinned for deterministic provenance.

# Asterfold 3.1.3

## Flash-free new-tab startup

- Added a critical first paint before React and the main stylesheet.
- Added a validated startup theme snapshot for built-in visual state.
- Deferred visible React rendering until the runtime theme and wallpaper are ready.
- Added compositor-safe one-time entrance motion with reduced-motion support.
- Added startup regression coverage.

# Asterfold 3.1.2

## Original-quality wallpapers

- Uploaded raster wallpapers are stored locally byte-for-byte at original dimensions.
- Quality and Compatibility modes use the original stored image.
- Software rendering uses a separate bounded Full HD compatibility copy.
- Added signature-based support for Chrome-decodable raster formats and backup format v4.
- Added real MV3 E2E coverage for 3840×2160 wallpapers and IndexedDB byte equality.

# Asterfold 3.1.1

## Wallpaper, Settings and import polish

- Replaced built-in wallpapers with licensed 4K assets and compatibility copies.
- Made Settings opaque.
- Added language flags.
- Imported bookmark Pages open immediately after import.

# Asterfold 3.1.0

## Windows adaptive performance

- Added automatic Quality / Compatibility / Software rendering profiles.
- Added Radeon R5 230 / Caicos compatibility handling.
- Added compositor-safe motion and Full-HD compatibility wallpaper assets.
- Added 600-bookmark stress gates.

# Asterfold 3.0.1

## Verified release pipeline and first-use hardening

- Added tag-only CI-gated publishing.
- Added exact-SHA workflow checks, deterministic packaging, SBOM, provenance and attestations.
- Added migration-safe launcher discovery and versioned audit evidence.

# Asterfold 2.2.3

## Chrome Web Store readiness

- Fixed Quick Save destination validation and cross-context Privacy Mode.
- Hardened scoped restore, bounded imports and HTML description round-trip.
- Added atomic free-grid moves, Settings race fixes and release gates.
