---
name: chrome-store-release-packaging
description: Chrome Web Store release engineering, deterministic packaging, store asset validation, SBOM and provenance generation, and reproducible build auditing. Use when preparing a production release, validating CWS submission packages, checking promotional assets, or verifying release checksums.
license: MIT
metadata:
  target-platforms: "Google Chrome Web Store, Developer Dashboard"
  standards: "SPDX 2.3, SLSA-provenance, SHA-256"
---

# Chrome Web Store Release Engineering & Packaging

## Deterministic Packaging Pipeline
- **Zero Drift between Operating Systems**:
  - Release archives (`Asterfold-Chrome.zip`) built on Linux and Windows must be bit-for-bit identical.
  - Normalization of file timestamps (fixed epoch: 2026-01-01T00:00:00Z).
  - Unix permissions normalization (`0644` for files, `0755` for directories).
  - Pinned `npm` version (`10.9.8`) to ensure deterministic `packageManager` provenance.

## Chrome Web Store Asset Requirements
- **Icons**:
  - `16x16`: Extension favicon and tab mark.
  - `32x32`: Windows taskbar and retina displays.
  - `48x48`: Chrome extension management page (`chrome://extensions`).
  - `128x128`: Chrome Web Store installation and store listings.
- **Promotional & Screenshot Specifications**:
  - Screenshots: exactly `1280x800` or `640x400` pixels, 24-bit PNG or WebP, no alpha transparency.
  - Small Promo Tile: `440x280` pixels.
  - Marquee Tile (optional): `1400x560` pixels.
  - All verified via `npm run validate:store`.

## Runtime Package Strict Allowlist
- **Runtime ZIP Inclusions (Only What Chrome Needs)**:
  - `manifest.json`
  - Bundled scripts (`.output/chrome-mv3/*.js`, chunks)
  - Bundled styles (`.output/chrome-mv3/assets/*.css`)
  - HTML entrypoints (`newtab.html`, `popup.html`)
  - Icons and wallpapers
- **Strict Exclusions**:
  - Never include markdown files (`README.md`, `HOW-TO-INSTALL.txt`), test files (`tests/`, `e2e/`), TypeScript source files, build scripts, or `.git` directories in the store upload ZIP.

## Release Verification Checklist
1. `npm run validate:version`: Ensure `package.json`, `package-lock.json`, manifest, and release notes align.
2. `npm run scan:source`: Verify no dangerous DOM sinks, dynamic code, or forbidden broad Chrome APIs exist.
3. `npm run validate:store`: Ensure store listings, screenshots, and metadata are intact.
4. `npm run release:repro`: Verify provenance, SBOM, and package reproducibility.
